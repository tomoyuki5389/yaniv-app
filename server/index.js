// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createDeck, dealCards, getCardValue } = require('../src/logic/gameState');

const app = express();
const server = http.createServer(app);

// CORS設定（Reactのフロントと接続できるようにする）
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

app.use(cors());

// ルーム情報を保存
const rooms = {}; // roomId -> game state

// シャッフル関数（Fisher-Yates）
// const shuffle = (array) => {
//     const newArray = [...array];
//     for (let i = newArray.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
//     }
//     return newArray;
// };

// サーバー起動時ログ
server.listen(3001, () => {
    console.log('✅ Socket.IO サーバー起動中 http://localhost:3001');
});

// Socket.IO　イベント設定
// コネクション時
io.on('connection', (socket) => {
    console.log(`🟢 ユーザー接続: ${socket.id}`);

    // 開発中のみ有効にする
    socket.onAny((event, ...args) => {
        console.log(`📩 [${socket.id}] 未処理イベント受信: "${event}"`, args);
    })

    const emitInvalidAction = (socket, message) => {
        if (socket) {
            socket.emit("invalid_action", message);
        }
    };

    // ルーム参加イベント
    socket.on('join_room', ({ roomId, playerName }) => {
        socket.join(roomId);
        socket.playerName = playerName;
        console.log(`➡️ ${playerName} (${socket.id}) がルーム ${roomId} に参加`);

        // ルームの作成あるいは更新
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [playerName],
                turnIndex: 0,
                hands: {},
                deck: [],
                discard: [],
                lastDiscardsByPlayer: {},
                isGameActive: false,
                scores: {},
            };
        } else {
            const room = rooms[roomId];
            if (!room.players.includes(playerName)) {
                room.players.push(playerName);
            }
        }

        const room = rooms[roomId];
        if (!room.scores[playerName]) {
            room.scores[playerName] = 0;
        }

        // プレイヤーが2人揃ったらゲーム開始
        if (room.players.length === 2 && !room.isGameActive) {
            const [p1, p2] = room.players;
            
            // 山札生成と配布
            // const fullDeck = shuffle(Array.from({ length: 52 }, (_, i) => i + 1));
            const fullDeck = createDeck();
            const { player1, player2, deck, discardPile } = dealCards(fullDeck);
            room.hands[p1] = player1;
            room.hands[p2] = player2;
            room.deck = deck;
            room.discard = discardPile;
            room.isGameActive = true;

            // 各プレイヤーに相手名を個別送信
            const clients = io.sockets.adapter.rooms.get(roomId) || new Set();
            clients.forEach(socketId => {
                const targetSocket = io.sockets.sockets.get(socketId);
                if (!targetSocket) return;
                const name = targetSocket.playerName;
                const opponent = room.players.find(p => p !== name);
                    targetSocket.emit('joined', { opponent });
            });
            
            // ゲーム開始の通知（各プレイヤーに自分の手札・山札・捨て札を送る）
            io.in(roomId).emit('start_game', {
                turn: p1, // 最初のプレイヤー
                hands: {
                    [p1]: room.hands[p1],
                    [p2]: room.hands[p2]
                },
                deck: room.deck,
                discard: room.discard
            });

            console.log(`🎮 ゲーム開始: ${p1} vs ${p2}`);
        }
    });

    const emitUpdateState = (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        const clients = io.sockets.adapter.rooms.get(roomId) || new Set();

        clients.forEach(socketId => {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (!targetSocket) return;

            const playerName = targetSocket.playerName;
            // if (!playerName || !room.hands[playerName]) {
            //     console.warn(`⚠️ playerNameが不明または無効: ${socketId}`);
            //     return;
            // } 

            const handInfo = { [playerName]: room.hands[playerName] };
            room.players.forEach(other => {
                if (other !== playerName) {
                    handInfo[other] = room.hands[other]?.length || 0;
                }
            });

            targetSocket.emit('update_state', {
                deck: room.deck,
                discard: room.discard,
                hands: handInfo,
                lastDiscardsByPlayer: room.lastDiscardsByPlayer || {},
            });
        });
    };

    const nextTurn = (roomId) => {
        const room = rooms[roomId];
        if (!room || !room.isGameActive) return;
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
        const nextPlayer = room.players[room.turnIndex];
        console.log(`🔄 次のターン: ${nextPlayer}`);
        io.in(roomId).emit('your_turn', nextPlayer);
    }

    const isValidDiscard = (cards) => {
        if (cards.length === 0) return true;
        if (cards.length === 1) return true;
        const ranks = cards.map(c => c.rank).filter(r => r !== "JOKER");
        return ranks.every(r => r === ranks[0]);
    }

    socket.on('discard_cards', ({ roomId, playerName, cards }) => {
        const room = rooms[roomId];
        console.log("📤 discard_cards送信時のcards_1:", cards);
        if (!room || !room.hands[playerName]) return;

        console.log("📤 discard_cards送信時のcards_2:", cards);

        if (!Array.isArray(cards) || cards.some(c => typeof c !== 'object' || !c.rank || !c.suit)) return;

        const handSet = new Set(room.hands[playerName].map(c => `${c.rank}-${c.suit}`));
        const allInHand = cards.every(c => handSet.has(`${c.rank}-${c.suit}`));
        if (!allInHand) {
            const missing = cards.filter(c => !handSet.has(`${c.rank}-${c.suit}`)); 
            const msg = `以下のカードが手札に存在しません: ${missing.map(c => `${c.rank}${c.suit}`).join(", ")}`;
            const targetSocket = io.sockets.sockets.get(socket.id);
            if (targetSocket) {
                targetSocket.emit("invalid_discard_draw", msg);
            }
            return;
        }

        if (!isValidDiscard(cards)) {
            const targetSocket = io.sockets.sockets.get(socket.id);
            if (targetSocket) {
                targetSocket.emit("invalid_discard_draw", "複数枚捨てる場合は、同じ数字のみ可能です（ジョーカーを除く）");
            }
            return;
        }

        room.hands[playerName] = room.hands[playerName].filter(card => !cards.some(c => c.rank === card.rank && c.suit === card.suit));
        const discarded = cards.map(card => ({ card, by: playerName }));

        // プレイヤーごとの直前捨て札を更新
        room.lastDiscardsByPlayer[playerName] = discarded;

        // 通常の捨て札リストにも追加
        room.discard.push(...discarded);

        // room.lastDiscardedCards = discarded;
        // room.discard.push(...room.lastDiscardedCards);

        emitUpdateState(roomId);

        const targetSocket = io.sockets.sockets.get(socket.id);
        if (targetSocket) {
            targetSocket.emit('discard_complete');
        }
    });

    socket.on('draw_from_deck', ({ roomId, playerName }) => {
        const room = rooms[roomId];
        if (!room || !room.deck.length || !room.hands[playerName]) {
            emitInvalidAction(socket, "カードを引けません。（山札が空か、ゲーム未開始）");
            return;
        }

        const card = room.deck.shift();
        room.hands[playerName].push(card);
        console.log(`🃏 ${playerName} が山札からカードを引いた`);

        emitUpdateState(roomId);

        const targetSocket = io.sockets.sockets.get(socket.id);
        if (targetSocket) targetSocket.emit('draw_complete');
        nextTurn(roomId);
    });

    socket.on('draw_from_discard', ({ roomId, playerName, card }) => {
        const room = rooms[roomId];
        if (!room || !room.hands[playerName]) return;

        // 指定されたカードの捨て札データを検索（末尾から検索）
        const index = room.discard.slice().reverse().findIndex(d => d.card.rank === card.rank && d.card.suit === card.suit);
        const actualIndex = index === -1 ? -1 : room.discard.length -1 -index;

        const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.playerName === playerName && s.rooms.has(roomId));

        if (actualIndex === -1){
            if (targetSocket) {
                targetSocket.emit("invalid_discard_draw", "指定のカードが見つかりません");
            }
            return;
        }
        const target = room.discard[actualIndex];

        // 存在しない or 自分の捨て札だった場合は無効
        if (!target || target.by === playerName) {
            if (targetSocket) {
                targetSocket.emit("invalid_discard_draw", "自分が捨てたカードは取得できません");
            }
            return;
        }

        // 取得し、捨て札から除外
        room.discard.splice(actualIndex, 1);
        room.hands[playerName].push(target.card);
        console.log(`🃏 ${playerName} が捨て札から ${target.card} を引いた`);

        emitUpdateState(roomId);

        if (targetSocket) targetSocket.emit('draw_complete');
        nextTurn(roomId);
    });

    socket.on('declare_yaniv', ({ roomId, playerName }) => {
        const room = rooms[roomId];
        if (!room || !room.hands[playerName] || !room.isGameActive) {
            emitInvalidAction(socket, "ヤニブ宣言できる状態ではありません");
            return;
        }

        room.isGameActive = false;

        const sums = room.players.map(p => ({
            name: p,
            total: room.hands[p].reduce((sum, card) => sum + (card.value || 0), 0)
        }));

        const declarer = sums.find(p => p.name === playerName);
        const others = sums.filter(p => p.name !== playerName);
        const lowerOrEqual = others.filter(p => p.total <= declarer.total);

        let result;
        if (declarer.total > 5) {
            result = { winner: lowerOrEqual[0].name, reason: 'ヤニブ宣言無効（合計6以上）' };
        } else if (lowerOrEqual.length === 0) {
            result = { winner: declarer.name, reason: 'ヤニブ成功' };
        } else {
            result = { winner: lowerOrEqual[0].name, reason: 'アスフー（相手の方が点が少ないか同じ）' };
        }

        room.scores[result.winner] += 1;
        console.log(`🎯 ${playerName} がヤニブ宣言（${declarer.total}点）→ ${result.winner} 勝利（理由: ${result.reason}）`);
        io.in(roomId).emit('game_result', result);
    });

    // 再戦イベント
    socket.on('request_rematch', ({ roomId, playerName}) => {
        const room = rooms[roomId];
        if (!room) return;

        // 初期化されていなければ初期化
        if (!room.rematchVotes) room.rematchVotes = new Set();

        // 投票を追加
        room.rematchVotes.add(playerName);

        // 両者がリクエストした場合にのみ再戦
        if (room.rematchVotes.size === 2) {
            const fullDeck = createDeck();
            const { player1, player2, deck, discardPile } = dealCards(fullDeck);
            const [p1, p2] = room.players;

            room.hands[p1] = player1;
            room.hands[p2] = player2;
            room.deck = deck;
            room.discard = discardPile;
            room.turnIndex = 0;
            room.isGameActive = true;
            room.lastDiscardsByPlayer = {};

            io.in(roomId).emit('rematch_ready', {
                turn: p1,
                hands: {
                    [p1]: player1,
                    [p2]: player2,
                },
                deck,
                discard: discardPile
            });

            room.rematchVotes.clear();
        }
    });

    socket.on('leave_room', ({ roomId, playerName }) => {
        const room = rooms[roomId];
        if (!room) return;

        console.log(`🚪 ${playerName} が手動でルーム ${roomId} を退出`);

        // プレイヤー情報を削除
        const index = room.players.indexOf(playerName);
        if (index !== -1) {
            room.players.splice(index, 1);
            delete room.hands[playerName];
            delete room.scores[playerName];
            if (room.rematchVotes) {
                room.rematchVotes.delete(playerName);
            }
        }

        // 残りプレイヤーが0ならルーム削除
        if (room.players.length === 0) {
            delete rooms[roomId];
            console.log(`🧹 全員退出 → ルーム ${roomId} を削除`);
        } else {
            // 相手に通知（optional）
            io.in(roomId).emit("opponent_left", { leaver: playerName });
        }

        socket.leave(roomId);
    });

    socket.on("opponent_left", ({ leaver }) => {
        getSystemErrorMessage(`${leaver} がルームを退出しました`);
    });

    // 切断イベント
    socket.on('disconnect', () => {
        console.log(`🔴 ユーザー切断: ${socket.id}`);    
        
        for (const [roomId, room] of Object.entries(rooms)) {
            const index = room.players.indexOf(socket.playerName);
            if (index !== -1) {
                room.players.splice(index, 1);
                delete room.hands[socket.playerName];
                delete room.scores[socket.playerName];
                console.log(`👋 ${socket.playerName} をルーム ${roomId} から削除`);

                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`🧹 ルーム ${roomId} を削除`);
                }
                break;
            }
        }
    });
});