# Sushi Tines 

## Proposed Improved Routing Implementation

The key to a faster routing solution is avoiding a linear scan of the accumulated disjoint graphs on each iteration of the routing graph.

The `findBestPathExactOut` is searching for overlapping graphs.[^0] Instead of searching, we can carry a lookup table that maps each vertex to an index in the accumulated disjoint graph vector.


For example, if the disjoint graphs vector contains two graphs with vertices {1, 2}, {3, 4} then the lookup table would contain 
 
$$  {1 -> 0, 2 -> 0, 3 -> 1, 4 -> 1} $$
 
This indicates that:
vertices 1 and 2 are at index 0 in the disjoint graphs vector
vertices 3 and 4 are at index 1


Moreover, creating a lookup table, we can replace a linear scan (i.e. `findBestPathExactOut`) with an effective constant time lookup (per vertex in the graph in question).


Determining the intersecting disjoint graphs can be accomplished by[^2]:
 
2.1 looking up each vertex in the index map and taking the union of the results.
2.1a If the result is empty, then the graph in question is disjoint with all other accumulated graphs. 
2.1b If the result is non-empty, then the graph intersects each of the corresponding disjoint graphs. 

In this case, we must **take the union of each of these graphs with the graph in question and store it at a new index**. 

We compute a new lookup table entry for the graphs that are changing positions[^3] (that is, there's no need to update the indices of the vertices of the graph that was at the target index, since those vertices aren't changing position).[^1]


In the case of multiple matching indices, we choose the minimum index so that overall, smaller indices have larger vertex sets. There's one catch however -- when there are multiple intersecting disjoint graphs, what do we do with the other indices -- the ones that differ from the target index? We can update those entries to null and upon overall completion, filter out the null values.


## Implementation Questions for Tines

                                                                                            undefined 
```dif                                                                                      undefined 
<   // console.log(`Removing edge ${minVert.token.address} -> ${minVertNext.token.address}`)undefined 
<   minVert.removeEdge(minVertNext)                                                         undefined 
---                                                                                         undefined 
> // console.assert(minVert !==                                                             undefined , 'Internal Error 564')
> if (minVert ===                                                                           undefined ) return
> const edge = minVert.getEdge(minVertNext)                                                 undefined 
> if (edge ===                                                                              undefined ) return
>   edge.canBeUsed = false
```

```console
:~ $ Property 'token0' will overwrite the base property in 'RPool'. If this is intentional, add an initializer. Otherwise, add a 'declare' modifier or remove the redundant declaration.ts(2612)
```


## Tests

fc.check

### Property
- union.empty:

### Unit
- union.singleton: 
- union.duplicates: 
- union.outputs disjoint: 
- union.inputs disjoint: 
- union.same edges and vertices: 

### Footnotes

[^0]: Technically, this condition will always return 'false' since the types 'Vertice' and 'Edge' have no overlap as currently implemented in Tines, due to a circular dependeny on the type implementation. 

[^1]: i.e. The target token1.

[^2]: There's some bookkeeping in updating the lookup table for each vertex in the resulting merged graph. And we can be efficient about the bookkeeping by only updating the lookup table for the vertices that are changing position.

[^3]: The lookup table is updated for the graph that is changing position, these are the fixed pools that are configurable for the purposes of the Onsen Incentives Program. 