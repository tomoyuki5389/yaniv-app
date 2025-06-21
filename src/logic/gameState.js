// logic/gameState.js

// 52枚のカード（ジョーカーなし）
const suits = ["♠", "♣","♥","♦"];
const ranks = [
    "A", "2", "3", "4", "5", "6", "7",
    "8", "9", "10", "J", "Q", "K"
];

export function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank, value: getCardValue(rank) });
        }
    }

    // ジョーカー2枚追加
    deck.push({ suit:  "🃏", rank: "JOKER", value:0 });
    deck.push({ suit:  "🃏", rank: "JOKER", value:0 });

    return shuffle(deck);
}

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function getCardValue(rank) {
    if (rank === "A") return 1;
    if (rank === "J") return 11;
    if (rank === "Q") return 12;
    if (rank === "K") return 13;
    if (rank === "JOKER") return 0;
    return parseInt(rank);
}

// カードを2人に初期配布（各5枚）
export function dealCards(deck) {
    const player1 = deck.slice(0, 5);
    const player2 = deck.slice(5, 10);
    const remainingDeck = deck.slice(10);
    const discardPile = [remainingDeck.pop()];
    return {
        player1,
        player2,
        deck: remainingDeck,
        discardPile
    };
}