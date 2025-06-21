// src/page/GameRoom.js
import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
// import { io } from "socket.io-client";
import socket from "../socket";
import styles from "../styles/GameRoom.module.css";

// const socket = io("http://localhost:3001"); // サーバーURLに合わせて変更

function GameRoom() {
    const location = useLocation();
    const params = useParams();

    const roomId = params.roomId;
    const playerName = location.state?.username ?? `guest_${Math.random().toString(36).slice(2, 6)}`;

    const [opponent, setOpponent] = useState(null);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [phase, setPhase] = useState("yaniv_check"); // yaniv_check → discard → draw 
    const [deck, setDeck] = useState([]);
    const [hand, setHand] = useState([]);
    const [opponentHandSize, setOpponentHandSize] = useState(0);
    const [selectedCards, setSelectedCards] = useState([]);
    const [selectedDiscardCard, setSelectedDiscardCard] = useState(null);
    const [lastDiscardsByPlayer, setLastDiscardsByPlayer] = useState({});
    const [message, setMessage] = useState("");
    const [resultMessage, setResultMessage] = useState("");
    const [handTotal, setHandTotal] = useState(0);
    const [errorMessage, setErrorMessage] = useState("");
    const [opponentLeft, setOpponentLeft] = useState(false);

    const handleInvalidAction = (msg) => {
        setErrorMessage(msg || "無効な操作です。");
        setTimeout(() => setErrorMessage(""), 3000);
    }

    useEffect(() => {
        if (!roomId || !playerName) {
            console.error("roomId または PlayerName が未定義です");
            return;
        }
        // 接続されていない場合のみ接続
        if (!socket.connected) {
            socket.connect();
        }

        const handleAllEvents = (eventName, ...args) => {
            console.warn("📩 クライアント受信: 未処理イベント", eventName, args);
        };

        socket.emit("join_room", { roomId, playerName });

        const handleJoined = (data) => {
            setOpponent(data.opponent);
        };

        const handleStartGame = ({ turn, hands, deck }) => {
            console.log("start_game) :", { hands, deck });

            setDeck(deck);
            setHand(hands[playerName] || []);
            updateHandTotal(hands[playerName] || []);

            const opponentName = Object.keys(hands).find(name => name !== playerName);
            if (opponentName) {
                setOpponent(opponentName);
                setOpponentHandSize(hands[opponentName]?.length || 0);
            }
            const isNow = turn === playerName && opponentName;
            setIsMyTurn(isNow);
            setPhase(isNow ? "yaniv_check" : null);
            setMessage(isNow ? "あなたのターンです" : "相手のターンです");
        };

        const handleYourTurn = (nextPlayer) => {
            const isNow = nextPlayer === playerName;
            setIsMyTurn(isNow);
            setPhase(isNow ? "yaniv_check" : null);
            setMessage(isNow ? "あなたのターンです" : "相手のターンです");
            setResultMessage("");            
        };

        const handleUpdateState = ({ deck, hands, lastDiscardsByPlayer }) => {
            setDeck(deck);
            setLastDiscardsByPlayer(lastDiscardsByPlayer || {});
            if (hands[playerName] !== undefined) {
                setHand(hands[playerName]);
                updateHandTotal(hands[playerName]);
            }
            if (opponent && hands[opponent] !== undefined) {
                setOpponentHandSize(
                    typeof hands[opponent] === "number" ? hands[opponent] : hands[opponent].length
                );
            }            
        };

        const handleGameResult = ({ winner, reason }) => {
            setResultMessage(`${winner} の勝利！ (${reason})`);            
        };

        const handleDiscardComplete = () => {
            setPhase("draw");
        };

        const handleInvalidDiscardDraw = (msg) => {
            setErrorMessage(msg || "不正な操作が行われました。");
            setTimeout(() => setErrorMessage(""),3000);
            if (phase === "discard") setPhase("discard");
            if (phase === "draw") setPhase("draw");
        };

        const handleDrawComplete = () => {
            setIsMyTurn(false);
            setPhase(null);
            setMessage("相手のターンです");
            setSelectedDiscardCard(null);             
        };

        const handleRematchReady = ({ turn, hands, deck, discard }) => {
            setDeck(deck);
            setHand(hands[playerName] || []);
            updateHandTotal(hands[playerName] || []);

            const opponentName = Object.keys(hands).find(name => name !== playerName);
            if (opponentName) {
                setOpponent(opponentName);
                setOpponentHandSize(hands[opponentName]?.length || 0);
            }
            const isNow = turn === playerName;
            setIsMyTurn(isNow);
            setPhase(isNow ? "yaniv_check" : null);
            setMessage(isNow ? "あなたのターンです" : "相手のターンです");
            setResultMessage("");
            setSelectedCards([]);
            setSelectedDiscardCard(null);
        }

        const handleOpponentLeft = ({ leaver }) => {
            setMessage(`${leaver} が退出しました`);
            setOpponentLeft(true);
        };

        socket.onAny(handleAllEvents);
        socket.on("invalid_action", handleInvalidAction);
        socket.on("joined", handleJoined);
        socket.on("start_game", handleStartGame);
        socket.on("your_turn", handleYourTurn);
        socket.on("update_state", handleUpdateState);
        socket.on("game_result", handleGameResult);
        socket.on("discard_complete", handleDiscardComplete);
        socket.on("invalid_discard_draw", handleInvalidDiscardDraw);
        socket.on("draw_complete", handleDrawComplete);
        socket.on("rematch_ready", handleRematchReady);
        socket.on("opponent_left", handleOpponentLeft);

        return () => {
            socket.offAny(handleAllEvents);
            socket.off("invalid_action", handleInvalidAction);
            socket.off("joined", handleJoined);
            socket.off("start_game", handleStartGame);
            socket.off("your_turn", handleYourTurn);
            socket.off("update_state", handleUpdateState);
            socket.off("game_result", handleGameResult);
            socket.off("discard_complete", handleDiscardComplete);
            socket.off("invalid_discard_draw", handleInvalidDiscardDraw);
            socket.off("draw_complete", handleDrawComplete);
            socket.off("rematch_ready", handleRematchReady);
            socket.off("opponent_left", handleOpponentLeft);

            // socket.disconnect(); // 明示的な切断
            socket.removeAllListeners(); // メモリリーク対策・意図しない再バインド防止
        };
    }, [roomId, playerName, opponent, phase]);

    const cardToString = (card) => {
        if (card.rank === "JOKER") return "🃏 Joker";
        return `${card.rank}${card.suit}`
    };

    const updateHandTotal = (cards) => {
        const total = cards.reduce((sum, card) => sum + card.value, 0);
        setHandTotal(total);
    }

    const handleDrawFromDeck = () => {
        if (!isMyTurn || phase !== "draw" || deck.length === 0) return;
        socket.emit("draw_from_deck", { roomId, playerName });
        setPhase(null);
    };

    const handleDrawFromDiscard = () => {
        if (!isMyTurn || phase !== "draw" ||  !selectedDiscardCard ) return;
        socket.emit("draw_from_discard", { roomId, playerName, card: selectedDiscardCard });
        setSelectedDiscardCard(null);
        setPhase(null);
    };

    const toggleSelectCard = (card) => {
        const isSelected = selectedCards.some(c => c.rank === card.rank && c.suit === card.suit);
        setSelectedCards(prev => isSelected ? prev.filter(c => !(c.rank === card.rank && c.suit === card.suit)) : [...prev, card]);
    };

    const handleDiscard = () => {
        if (!isMyTurn || phase !== "discard" || selectedCards.length === 0) return;
        
        socket.emit("discard_cards", {
            roomId,
            playerName,
            cards: selectedCards,
        });

        setSelectedCards([]);
    };

    const handleDeclareYaniv = () => {
        if (!isMyTurn || phase !== "yaniv_check") return;
        socket.emit("declare_yaniv", { roomId, playerName });
    };

    const handleSkipYaniv = () => {
        if (!isMyTurn || phase !== "yaniv_check") return;
        setPhase("discard");
    };

    const handleRematch = () => {
        socket.emit("request_rematch", { roomId, playerName });
    };

    const handleLeaveRoom = () => {
        socket.emit("leave_room", { roomId, playerName });
        socket.disconnect(); // サーバとの接続を切断
        window.location.href = "/" // ホーム画面にリダイレクト（任意でnavigate でもOK）
    }

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>ルームID: {roomId}</h2>
            <div className={styles.playerBox}>
                <p>あなた: {playerName}</p>
                <p>{opponent ? `相手: ${opponent}` : "相手を待っています..."}</p>
                <p>相手の手札: {opponentHandSize} 枚</p>
            </div>

            <div className={styles.turnIndicator}>{message}</div>

            <div className={`${styles.phaseIndicator} ${
                !opponent               ? styles.phaseWait :
                phase === "yaniv_check" ? styles.phaseYaniv : 
                phase === "discard"     ? styles.phaseDiscard : 
                phase === "draw"        ? styles.phaseDraw :
                styles.phaseWait
            }`}>
                現在のフェーズ：<strong>
                    {!opponent
                     ? "(ゲーム未開始)"
                     : phase === "yaniv_check" 
                     ? "ヤニブ判定" 
                     : phase === "discard" 
                     ? "(カードを選択後)カードを捨てる" 
                     : phase === "draw"
                     ? "カードを引く"
                     : "待機中"}
                </strong>
            </div>

            <div className={styles.controls}>
                <button onClick={handleDeclareYaniv} disabled={!isMyTurn || phase !== "yaniv_check" || handTotal > 5}
                    className={`${isMyTurn && phase === "yaniv_check" ? styles.highlightButton : ""}`}
                >
                    ヤニブ！（合計 {handTotal}）
                </button>
                
                {isMyTurn && phase === "yaniv_check" && (
                    <button onClick={handleSkipYaniv}
                        className={`${isMyTurn && phase === "yaniv_check" ? styles.highlightButton : ""}`}
                    >
                        ヤニブせず捨てに進む
                    </button>
                )}

                <button onClick={handleDiscard} disabled={!isMyTurn || phase !== "discard"}
                    className={`${phase === "discard" ? styles.highlightButton : ""}`}
                >
                    選択したカードを捨てる
                </button>

                <button onClick={handleDrawFromDeck} disabled={!isMyTurn || phase !== "draw"}
                    className={`${phase === "draw" ? styles.highlightButton : ""}`}
                >
                    山札から引く
                </button>

                <button onClick={handleDrawFromDiscard} disabled={!isMyTurn || phase !== "draw" || !selectedDiscardCard}
                    className={`${phase === "draw" ? styles.highlightButton : ""}`}
                >
                    捨て札から引く
                </button>
            </div>

            <div className={styles.section}>
                <h3>あなたの手札（合計: {handTotal}）</h3>
                <div className={styles.cards}>
                    {hand.map((card, index) => (
                        <div
                            key={index}
                            className={`${styles.card} ${selectedCards.some(c => c.rank === card.rank && c.suit === card.suit) ? styles.selected : ""}`}
                            onClick={() => toggleSelectCard(card)}
                        >
                            {cardToString(card)}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.section}>
                <h3>捨て札一覧（前ターン）</h3>
                <p>相手が前ターンに捨てたカード</p>
                <div className={styles.cards}>
                    {(lastDiscardsByPlayer[opponent] || []).map((d, index) =>(
                        <div
                            key={`opponent-${index}`}
                            className={`${styles.card} ${
                                selectedDiscardCard && selectedDiscardCard.rank === d.card.rank && selectedDiscardCard.suit === d.card.suit ? styles.selected : ""
                            } ${d.by === playerName ? styles.disabled : ""}`}
                            onClick={() => {
                                if (phase === "draw" && d.by !== playerName) {
                                    setSelectedDiscardCard(d.card);
                                }
                            }}
                        >
                            {cardToString(d.card)}<br />
                            <small>by {d.by}</small>
                        </div>
                    ))}
                </div>

                <p>あなたが前ターンに捨てたカード</p>
                <div className={styles.cards}>
                    {(lastDiscardsByPlayer[playerName] || []).map((d, index) => (
                        <div key={`self-${index}`} className={`${styles.card} ${styles.disabled}`}>
                            {cardToString(d.card)}
                            <br />
                            <small>by {d.by}</small>
                        </div>
                    ))}
                </div>
            </div>

            {message && <p className={styles.message}>{message}</p>}

            {resultMessage && (
                <div>
                    <p className={styles.result}>{resultMessage}</p>
                    <button onClick={handleRematch} className={styles.rematchButton} disabled={opponentLeft} >再戦する</button>
                    {opponentLeft && <p className={styles.message}>相手が退出したため再戦できません</p>}
                </div>
            )}

            <button onClick={handleLeaveRoom} className={styles.button}>
                ルームを退出する
            </button>
            
            {errorMessage && <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p>}
        </div>
    );
}

export default GameRoom;
