"use strict";

const QuizScoring = (() => {
  const profiles = [
    [43, 19, 19, 19], [19, 43, 19, 19], [19, 19, 43, 19], [19, 19, 19, 43],
    [36, 36, 14, 14], [14, 36, 36, 14], [14, 14, 36, 36], [36, 14, 14, 36],
  ];

  function readOptions(questions, choices) {
    if (!Array.isArray(choices) || choices.length !== questions.length) throw new RangeError("请完成全部题目。");
    return questions.map(({ options }, index) => {
      const choice = choices[index];
      if (!Number.isInteger(choice) || choice < 0 || choice >= options.length) throw new RangeError(`第 ${index + 1} 题需要有效选项。`);
      return options[choice];
    });
  }

  function score(questions, choices) {
    const counts = [0, 0, 0, 0];
    const selected = readOptions(questions, choices).map(({ dimension }) => {
      counts[dimension] += 1;
      return dimension;
    });

    const distances = profiles.map((target, index) => ({
      index, target,
      distance: counts.reduce((sum, count, dimension) => sum + (100 * count - selected.length * target[dimension]) ** 2, 0),
    }));
    distances.sort((left, right) => {
      if (left.distance !== right.distance) return left.distance - right.distance;
      for (let index = selected.length - 1; index >= 0; index -= 1) {
        const dimension = selected[index];
        const evidence = right.target[dimension] - left.target[dimension];
        if (evidence) return evidence;
      }
      return left.index - right.index;
    });
    return { profile: distances[0].index, counts };
  }

  function scoreType(questions, choices, axes) {
    const totals = axes.map(() => ({ left: 0, right: 0, last: 0 }));
    readOptions(questions, choices).forEach(({ weight }, index) => {
      const total = totals[questions[index].axis];
      if (weight > 0) total.left += weight;
      else total.right -= weight;
      total.last = weight;
    });
    if (totals.some(({ last }) => last === 0)) throw new RangeError("测试需要覆盖全部偏好维度。");
    const balances = totals.map(({ left, right, last }, index) => ({
      left, right, tied: left === right,
      letter: axes[index].letters[(left - right || last) > 0 ? 0 : 1],
    }));
    return { code: balances.map(({ letter }) => letter).join(""), balances };
  }

  return { score, scoreType };
})();

if (typeof module === "object" && module.exports) module.exports = QuizScoring;
