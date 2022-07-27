import { revertPositive } from './Utils';
// Simplified abstraction of pool - all that Redistributor needed and nothing more
class Pool {
    from;
    to;
    edge;
    direction;
    constructor(fromIndex, toIndex, edge, from) {
        this.from = fromIndex;
        this.to = toIndex;
        this.edge = edge;
        this.direction = edge.pool.token0.address === from.token.address;
    }
    calcOutByIn(amountIn) {
        return this.edge.pool.calcOutByIn(amountIn, this.direction).out;
    }
    input() {
        return this.direction ? this.edge.amountInPrevious : this.edge.amountOutPrevious;
    }
}
export class Redistributor {
    tokenNumber; // Number of tokens
    tokensTopologySorted; // List of all tokens, from input token to output
    tokenIndex; // Index of a token in tokensTopologySorted
    outputTokens; // tokenIndex => tokenIndex[] - all output tokens for a given token
    pools; // [tokenIndexFrom, tokenIndexTo] => Pool[] - list of all pools between a given
    // pair of tokens. Please use getPools/setPools functions only to access this field
    paths; // [tokenIndexFrom, tokenIndexTo] => Pool[] - list of all pools that could be
    // start of the path from tokenIndexFrom to tokenIndexTo (any tokens, maybe not connected
    // by a pool). Please use getPaths/setPaths functions only to access this field
    getPaths(from, to) {
        return this.paths[from * this.tokenNumber + to];
    }
    setPaths(from, to, paths) {
        this.paths[from * this.tokenNumber + to] = paths;
    }
    getPools(from, to) {
        return this.pools[from * this.tokenNumber + to];
    }
    setPools(from, to, pools) {
        this.pools[from * this.tokenNumber + to] = pools;
    }
    constructor(_nodesTopologySorted) {
        this.tokenNumber = _nodesTopologySorted.length;
        this.tokensTopologySorted = _nodesTopologySorted;
        this.tokenIndex = new Map();
        _nodesTopologySorted.forEach((n, i) => this.tokenIndex.set(n, i));
        this.outputTokens = new Array(this.tokenNumber); // TODO: test with []
        this.pools = new Array(this.tokenNumber * this.tokenNumber); // TODO: test with []
        _nodesTopologySorted.forEach((n, i) => {
            const edges = n.getOutputEdges();
            const nodes = edges.map((e) => this.tokenIndex.get(n.getNeighbor(e)));
            this.outputTokens[i] = [...new Set(nodes)];
            for (let j = 0; j < nodes.length; ++j) {
                const pools = this.getPools(i, j) || [];
                pools.push(new Pool(i, j, edges[j], n));
                this.setPools(i, j, pools);
            }
        });
        this.paths = new Array(this.tokenNumber); // TODO: test with []
        // eslint-disable-next-line for-direction
        for (let i = this.tokenNumber - 2; i >= 0; ++i) {
            const nextNodes = this.outputTokens[i];
            for (let j = i + 1; j < this.tokenNumber; ++j) {
                const paths = [];
                // if (j in) ...  TODO: to finish
                for (let k = 0; k < nextNodes.length; ++k) {
                    if (this.getPaths(k, j) !== undefined) {
                        const pools = this.getPools(i, k);
                        if (pools !== undefined) {
                            paths.push(...pools);
                        }
                        else {
                            console.assert(0, 'Internal Error 81');
                        }
                    }
                }
                this.setPaths(i, j, paths);
            }
        }
    }
    // TODO: maybe it would be better to go from end to beginning for the outer cycle
    redistribute() {
        for (let i = 0; i < this.tokenNumber - 1; ++i) {
            for (let j = i + 1; j < this.tokenNumber; ++j) {
                const paths = this.getPaths(i, j);
                if (paths !== undefined && paths.length > 1) {
                    this.redistrPaths(i, j, paths);
                }
            }
        }
    }
    redistrPaths(from, to, paths) {
        // TODO: this code was taken from investigation part, should be rearranged for current environment
        /*if (amountIn == 0) {
          return [0, 0, [1]];
        }
    
        if (subRouters.length == 1) {
          const [out, gas] = subRouters[0].calcOutByIn(amountIn);
          return [out, gas, [1]];
        }
    
        let distr = subRouters.map(p => Math.max(p.calcOutByIn(amountIn/subRouters.length)[0], 0));
        
        for(let i = 0; i < 5; ++i) {
          const sum = distr.reduce((a, b) => a+b, 0);
          console.assert(sum > 0, "Error 508 " + sum + " " + i + " " + amountIn);
          
          const prices = distr.map((d, j) => 1/subRouters[j].calcPrice(amountIn*d/sum))
          const pr = prices.reduce((a, b) => Math.max(a, b), 0);
          
          distr = subRouters.map((p, i) => p.calcInputByPrice(pr, distr[i]));
        }
    
        const sum = distr.reduce((a, b) => a + b, 0);
        distr = distr.map(d => d/sum);
    
        let out = 0, gas = 0;
        for (let i = 0; i < subRouters.length; ++i) {
          const [out0, gas0] = subRouters[i].calcOutByIn(distr[i]*amountIn);
          out += out0;
          gas += gas0;
        }
    
        return [out, gas, distr];*/
    }
    calcOutput(from, to, paths, amountIn) {
        if (from == to)
            return amountIn;
        if (paths.length == 1) {
            const amountOut = paths[0].calcOutByIn(amountIn);
            const p = this.getPaths(paths[0].to, to);
            if (p !== undefined) {
                const out = this.calcOutput(paths[0].to, to, p, amountOut);
                return out;
            }
            else {
                console.assert(0, 'Internal Error 78');
                return -1;
            }
        }
        else {
            const distr = paths.map((p) => p.input());
            const sum = distr.reduce((a, b) => a + b, 0);
            let out = 0;
            for (let i = 0; i < paths.length; ++i) {
                out += this.calcOutput(from, to, [paths[i]], (amountIn * distr[i]) / sum);
            }
            return out;
        }
    }
    calcPrice(from, to, paths, amountIn) {
        const out1 = this.calcOutput(from, to, paths, amountIn);
        const out2 = this.calcOutput(from, to, paths, amountIn * 1.001);
        return ((out2 - out1) * 1000) / amountIn;
    }
    calcInputForPrice(from, to, paths, amountIn, price) {
        return revertPositive((x) => this.calcPrice(from, to, paths, x), price, amountIn);
    }
}
//# sourceMappingURL=Redistributor.js.map