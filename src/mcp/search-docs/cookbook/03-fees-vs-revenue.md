# Compare protocol fees vs revenue

Joins each protocol's 24h fees against its 24h revenue to surface where fees translate into protocol revenue. Call `getFeesOverview` twice — once with `dataType: 'dailyFees'` and once with `dataType: 'dailyRevenue'` — then join the two `.protocols` arrays by name.

```js
async function run(defillama) {
  const feesOv = await defillama.fees.getFeesOverview({ dataType: "dailyFees" });
  const revOv = await defillama.fees.getFeesOverview({ dataType: "dailyRevenue" });

  const revByName = new Map(
    (revOv.protocols ?? []).map((p) => [p.name, p.total24h ?? 0]),
  );

  return (feesOv.protocols ?? [])
    .map((p) => ({
      name: p.name,
      fees24h: p.total24h ?? 0,
      revenue24h: revByName.get(p.name) ?? 0,
    }))
    .sort((a, b) => b.fees24h - a.fees24h)
    .slice(0, 10);
}
```
