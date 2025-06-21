// src/logic/turnManager.js
import { getCardValue } from "./gameState";

/**
 * プレイヤーが山札から1枚引く
 */
export function drawFromDeck(deck, hand) {
    if (deck.length === 0) return { deck, hand }; // 山札が空なら何もしない

    const newCard = deck[0];
    return {
        deck: deck.slice(1),
        hand: [...hand, newCard],
    };
}

/**
 * プレイヤーが捨て札のトップから1枚引く
 */
export function drawFromDiscard(discardPile, hand) {
    if (discardPile.length === 0) return { discardPile, hand };

    const newCard = discardPile[discardPile.length - 1];
    return {
        discardPile: discardPile.slice(0, -1),
        hand: [...hand, newCard],
    };
}

/**
 * プレイヤーがカードを1枚以上捨てる
 * @param {string[]} hand
 * @param {string[]} cardsToDiscard
 */
export function discardsCards(hand, discardPile, cardsToDiscard) {
    const updatedHand = hand.filter((card) => !cardsToDiscard.includes(card));
    return {
        hand: updatedHand,
        discardPile: [...discardPile, ...cardsToDiscard],
    };
}

/**
 * 手札の合計点数を計算
 */
export function calculateHandPoints(hand) {
    return hand.reduce((sum, card) => sum + getCardValue(card), 0);
}

/**
 * ターン交代
 */
export function switchPlayer(currentPlayer, players) {
    return players.find((p) => p !== currentPlayer);
}