// XP → level with rising thresholds (level N needs 250*N xp). Pure + testable.
export function levelForXp(xp: number) {
  let level = 1
  let need = 250
  let acc = 0
  while (xp >= acc + need) {
    acc += need
    level += 1
    need = 250 * level
  }
  return { level, into: xp - acc, need }
}
