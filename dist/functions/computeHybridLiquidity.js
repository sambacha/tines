import { BigNumber } from '@ethersproject/bignumber/lib.esm/index.js';
import { A_PRECISION } from '../constants';
export function computeHybridLiquidity(r0, r1, a) {
    if (r0.isZero() && r1.isZero()) {
        return BigNumber.from(0);
    }
    const s = r0.add(r1);
    const nA = BigNumber.from(a * 2);
    let prevD;
    let D = s;
    for (let i = 0; i < 256; i++) {
        const dP = D.mul(D).div(r0).mul(D).div(r1).div(4);
        prevD = D;
        D = nA
            .mul(s)
            .div(A_PRECISION)
            .add(dP.mul(2))
            .mul(D)
            .div(nA.div(A_PRECISION).sub(1).mul(D).add(dP.mul(3)));
        if (D.sub(prevD).abs().lte(1)) {
            break;
        }
    }
    return D;
}
//# sourceMappingURL=computeHybridLiquidity.js.map