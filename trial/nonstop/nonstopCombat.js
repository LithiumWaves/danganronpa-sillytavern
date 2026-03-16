import { NSD_EVENTS } from './nonstopEvents.js';
import { normalizeQuoteText } from './nonstopQuoteParser.js';

export function createNonstopCombat({ eventBus } = {}) {
    function attachWeakPoint({ token, quote, turnIndex, debateId }) {
        if (!token || turnIndex < 2) return null;
        const fragment = token.fragment || '';
        if (!fragment.trim()) return null;
        return {
            id: `weak_${debateId}_${turnIndex}`,
            turnId: `turn_${turnIndex}`,
            quoteFragment: fragment,
            normalizedText: normalizeQuoteText(fragment),
            matched: false,
            tokenId: token.tokenId,
            debateId,
            fullQuote: quote,
        };
    }

    function resolveShot({ session, weakPointId, tokenId, debateId, bulletText = '' }) {
        if (!session?.weakPoint) {
            eventBus?.emit(NSD_EVENTS.HIT_REJECTED, { reason: 'no_weak_point' });
            return { hit: false, reason: 'no_weak_point' };
        }
        const weakPoint = session.weakPoint;
        if (weakPoint.matched) return { hit: false, reason: 'already_matched' };
        if (String(debateId) !== String(session.debateId)) return { hit: false, reason: 'wrong_debate' };
        if (String(weakPointId) !== String(weakPoint.id) || String(tokenId) !== String(weakPoint.tokenId)) {
            eventBus?.emit(NSD_EVENTS.HIT_REJECTED, { reason: 'token_mismatch', weakPointId, tokenId });
            return { hit: false, reason: 'token_mismatch' };
        }

        const normalizedBullet = normalizeQuoteText(bulletText);
        if (normalizedBullet && !normalizedBullet.includes(weakPoint.normalizedText)) {
            eventBus?.emit(NSD_EVENTS.HIT_REJECTED, { reason: 'bullet_mismatch' });
            return { hit: false, reason: 'bullet_mismatch' };
        }

        weakPoint.matched = true;
        eventBus?.emit(NSD_EVENTS.HIT_CONFIRMED, { weakPointId: weakPoint.id, tokenId: weakPoint.tokenId });
        return { hit: true, weakPointId: weakPoint.id };
    }

    return { attachWeakPoint, resolveShot };
}
