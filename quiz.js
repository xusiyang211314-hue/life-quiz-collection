"use strict";

const el = (id) => document.getElementById(id);
const steps = [el("home"), el("game"), el("result")];
const total = QUIZ.questions.length;
const options = el("options");
const next = el("next");
const previous = el("previous");
const download = el("download");
const status = el("download-status");
let answers = new Array(total).fill(null);
let cursor = 0;
let finalProfile = null;
let pendingDownload = false;

function show(id, focus) {
  for (const step of steps) step.hidden = step.id !== id;
  window.scrollTo({ top: 0, behavior: "instant" });
  focus.focus({ preventScroll: true });
}

function updateProgress() {
  const count = answers.filter((answer) => answer !== null).length;
  el("game-count").textContent = `已答 ${count} / ${total} 题`;
  el("progress").setAttribute("aria-valuenow", String(count));
  el("progress-fill").style.width = `${(count / total) * 100}%`;
  next.disabled = answers[cursor] === null;
}

function renderQuestion(animate = true) {
  const current = QUIZ.questions[cursor];
  el("question-meta").textContent = `第 ${cursor + 1} / ${total} 题 · ${QUIZ.sections[Math.floor(cursor / 8)]}`;
  el("question").textContent = current.prompt;

  const choices = current.options.map(({ text }, index) => {
    const label = document.createElement("label");
    label.className = "choice";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = String(index);
    input.checked = answers[cursor] === index;
    const face = document.createElement("span");
    face.className = "choice-face";
    const letter = document.createElement("span");
    letter.className = "letter";
    letter.setAttribute("aria-hidden", "true");
    letter.textContent = "ABCD"[index];
    const copy = document.createElement("span");
    copy.textContent = text;
    face.append(letter, copy);
    label.append(input, face);
    return label;
  });
  options.replaceChildren(...choices);
  previous.disabled = cursor === 0;
  next.textContent = cursor === total - 1 ? "查看结果" : "下一题";
  updateProgress();
  if (!animate) return;
  el("question").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
  const content = el("question-content");
  if (typeof content.animate === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    content.getAnimations().forEach((animation) => animation.cancel());
    content.animate([{ opacity: .36, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 190 });
  }
}

function enterQuiz() {
  renderQuestion(false);
  show("game", el("question"));
}

function renderResult() {
  const { profile, counts } = QuizScoring.score(QUIZ.questions, answers);
  finalProfile = QUIZ.profiles[profile];
  el("result-name").textContent = finalProfile.name;
  for (const key of ["identity", "quote", "reason", "strength", "extra"]) el(key).textContent = finalProfile[key];
  const descriptions = QUIZ.dimensions.map((name, index) => {
    const item = document.createElement("div");
    const label = document.createElement("dt");
    const count = document.createElement("dd");
    label.textContent = name;
    count.textContent = `${counts[index]} 次`;
    item.append(label, count);
    return item;
  });
  el("tendencies").replaceChildren(...descriptions);
  status.textContent = "";
  download.disabled = pendingDownload;
  show("result", el("result-heading"));
}

function paintLines(context, sentence, left, top, width, leading) {
  let line = "";
  let y = top;
  for (const character of sentence) {
    if (line && context.measureText(line + character).width > width && !"，。、！？」）》：；".includes(character)) {
      context.fillText(line, left, y);
      line = "";
      y += leading;
    }
    line += character;
  }
  if (line) context.fillText(line, left, y);
}

function renderShareImage(profile, artwork) {
  const width = 1080;
  const height = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const style = getComputedStyle(document.body);
  const color = (name) => style.getPropertyValue(`--${name}`).trim();
  const serif = color("display");
  const sans = color("body");
  const tint = color("tint");
  const theme = color("theme");

  context.fillStyle = tint;
  context.fillRect(0, 0, width, height);
  const imageTop = 520;
  const imageHeight = height - imageTop;
  const cropHeight = artwork.naturalWidth * imageHeight / width;
  context.drawImage(artwork, 0, (artwork.naturalHeight - cropHeight) * .56, artwork.naturalWidth, cropHeight, 0, imageTop, width, imageHeight);

  const gradient = context.createLinearGradient(0, imageTop, 0, height);
  gradient.addColorStop(0, tint);
  gradient.addColorStop(.22, tint);
  gradient.addColorStop(.52, `${tint}00`);
  gradient.addColorStop(.74, "#15171c08");
  gradient.addColorStop(1, "#15171ce6");
  context.fillStyle = gradient;
  context.fillRect(0, imageTop, width, imageHeight);

  context.lineWidth = 2;
  context.strokeStyle = theme;
  context.strokeRect(24, 24, width - 48, height - 48);
  context.strokeStyle = `${theme}77`;
  context.strokeRect(33, 33, width - 66, height - 66);
  context.fillStyle = theme;
  context.font = `750 35px ${serif}`;
  context.fillText("生活有答", 82, 126);
  context.fillRect(82, 151, 916, 2);
  context.font = `680 34px ${sans}`;
  context.fillText(profile.identity, 82, 242);
  const titleSize = Math.min(134, Math.floor(890 / [...profile.name].length));
  context.font = `750 ${titleSize}px ${serif}`;
  context.fillText(profile.name, 78, 390);
  context.fillRect(83, 470, 4, 114);
  context.fillStyle = color("ink");
  context.font = `700 48px ${serif}`;
  paintLines(context, profile.quote, 108, 513, 835, 67);
  context.fillStyle = "#fffdf7";
  context.font = `600 32px ${sans}`;
  paintLines(context, QUIZ.title, 82, 1350, 920, 44);
  return canvas;
}

async function saveShareImage() {
  const profile = finalProfile;
  if (!profile || pendingDownload) return;
  pendingDownload = true;
  download.disabled = true;
  status.textContent = "正在生成分享图…";
  try {
    const artwork = new Image();
    artwork.src = QUIZ.art;
    await artwork.decode();
    const canvas = renderShareImage(profile, artwork);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("图片生成失败。");
    if (profile !== finalProfile) return;
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `生活有答-${profile.name}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60000);
    status.textContent = "分享图已生成，请查看浏览器下载。";
  } catch {
    if (profile === finalProfile) status.textContent = "暂时无法保存图片，可以截取上方结果卡。";
  } finally {
    pendingDownload = false;
    download.disabled = false;
  }
}

el("start").addEventListener("click", enterQuiz);
el("cover-back").addEventListener("click", () => {
  el("start").textContent = answers.some((answer) => answer !== null) ? "继续我的测试" : QUIZ.action;
  show("home", el("cover-title"));
});
options.addEventListener("change", (event) => {
  if (event.target.name !== "answer" || !event.target.checked) return;
  answers[cursor] = Number(event.target.value);
  updateProgress();
});
previous.addEventListener("click", () => {
  if (!cursor) return;
  cursor -= 1;
  renderQuestion();
});
el("question-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (answers[cursor] === null) return;
  if (cursor === total - 1) {
    renderResult();
  } else {
    cursor += 1;
    renderQuestion();
  }
});
download.addEventListener("click", saveShareImage);
el("restart").addEventListener("click", () => {
  answers = new Array(total).fill(null);
  cursor = 0;
  finalProfile = null;
  enterQuiz();
});
