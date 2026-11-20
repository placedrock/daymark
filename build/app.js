const STORAGE_KEY = "daymark.habits.v1";
const habitList = document.querySelector("#habit-list");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#habit-dialog");
const form = document.querySelector("#habit-form");
const toast = document.querySelector("#toast");
let selectedIcon = "🌱";
let toastTimer;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadHabits() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) throw new Error("Saved habits must be a list.");
    return saved.filter((habit) =>
      habit && typeof habit.id === "string" &&
      typeof habit.name === "string" &&
      typeof habit.icon === "string" &&
      typeof habit.category === "string" &&
      Array.isArray(habit.events) &&
      habit.events.every((event) => typeof event === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event))
    );
  } catch (error) {
    console.error("Could not load saved habits.", error);
    showToast("Saved habits couldn’t be loaded.");
    return [];
  }
}

let habits = loadHabits();

function saveHabits() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    return true;
  } catch (error) {
    console.error("Could not save habits.", error);
    showToast("Your changes couldn’t be saved. Check your browser storage.");
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function getTodayCount(habit) {
  return habit.events.filter((date) => date === localDateKey()).length;
}

function getHabitStreak(habit) {
  const uniqueDates = [...new Set(habit.events)].sort().reverse();
  if (!uniqueDates.length) return 0;
  const today = localDateKey();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate);
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;
  let streak = 0;
  let expected = new Date(`${uniqueDates[0]}T12:00:00`);
  for (const date of uniqueDates) {
    if (date !== localDateKey(expected)) break;
    streak += 1;
    expected.setDate(expected.getDate() - 1);
  }
  return streak;
}

function getCurrentStreak() {
  const dates = new Set(habits.flatMap((habit) => habit.events));
  let day = new Date();
  if (!dates.has(localDateKey(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (dates.has(localDateKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderHabits() {
  const today = localDateKey();
  const completed = habits.filter((habit) => getTodayCount(habit) > 0).length;
  document.querySelector("#habits-count").textContent = habits.length;
  document.querySelector("#nav-count").textContent = habits.length;
  document.querySelector("#progress-value").innerHTML = `${completed}<span>/${habits.length}</span>`;
  document.querySelector("#progress-fill").style.width = habits.length ? `${completed / habits.length * 100}%` : "0%";
  const currentStreak = getCurrentStreak();
  document.querySelector("#current-streak").innerHTML = `${currentStreak} <small>day${currentStreak === 1 ? "" : "s"}</small>`;
  document.querySelector("#best-streak").textContent = `${currentStreak} day${currentStreak === 1 ? "" : "s"} streak`;
  document.querySelector("#total-checkins").textContent = habits.reduce((total, habit) => total + habit.events.length, 0);
  emptyState.hidden = habits.length > 0;
  habitList.hidden = habits.length === 0;

  habitList.innerHTML = habits.map((habit) => {
    const todayCount = getTodayCount(habit);
    const streak = getHabitStreak(habit);
    const isDone = todayCount > 0;
    const countLabel = todayCount > 1 ? ` · ${todayCount} check-ins today` : "";
    return `<article class="habit-card${isDone ? " is-done" : ""}">
      <div class="habit-icon" aria-hidden="true">${escapeHtml(habit.icon)}</div>
      <div class="habit-info">
        <h3 class="habit-title">${escapeHtml(habit.name)}</h3>
        <div class="habit-meta"><span class="category-tag">${escapeHtml(habit.category)}</span><span class="meta-dot">·</span><span>${streak ? `✦ ${streak} day${streak === 1 ? "" : "s"} streak` : "Ready when you are"}${countLabel}</span></div>
      </div>
      <div class="habit-actions">
        <button class="log-button${isDone ? " done" : ""}" type="button" data-log="${escapeHtml(habit.id)}" aria-label="Log ${escapeHtml(habit.name)}">
          <span class="check" aria-hidden="true">${isDone ? "✓" : "+"}</span>${isDone ? "Log again" : "Log today"}
        </button>
        <button class="more-button" type="button" data-delete="${escapeHtml(habit.id)}" aria-label="Delete ${escapeHtml(habit.name)}">···</button>
      </div>
    </article>`;
  }).join("");
  renderWeekChart();
}

function renderWeekChart() {
  const chart = document.querySelector("#week-chart");
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }), count: habits.reduce((sum, habit) => sum + habit.events.filter((event) => event === key).length, 0), today: index === 6 };
  });
  const max = Math.max(1, ...days.map((day) => day.count));
  chart.innerHTML = days.map((day) => `<div class="chart-day${day.today ? " today" : ""}" aria-label="${day.label}: ${day.count} check-ins">
    <div class="chart-bar-wrap"><div class="chart-bar" style="height:${day.count ? Math.max(8, day.count / max * 100) : 0}%"></div></div>
    <span class="chart-label">${day.label}</span>
  </div>`).join("");
  const total = days.reduce((sum, day) => sum + day.count, 0);
  document.querySelector("#activity-summary").textContent = total
    ? `${total} check-in${total === 1 ? "" : "s"} in the last 7 days. Keep that momentum going!`
    : "Your check-ins will show up here.";
}

function openDialog() {
  form.reset();
  selectedIcon = "🌱";
  document.querySelectorAll(".icon-choice").forEach((button) => button.classList.toggle("selected", button.dataset.icon === selectedIcon));
  dialog.showModal();
  document.querySelector("#habit-name").focus();
}

function updateDate() {
  document.querySelector("#today-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

document.querySelector("#open-add").addEventListener("click", openDialog);
document.querySelector("#empty-add").addEventListener("click", openDialog);
document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => dialog.close()));
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.querySelectorAll(".icon-choice").forEach((button) => {
  button.addEventListener("click", () => {
    selectedIcon = button.dataset.icon;
    document.querySelectorAll(".icon-choice").forEach((choice) => choice.classList.toggle("selected", choice === button));
  });
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  if (!name) {
    document.querySelector("#habit-name").focus();
    return;
  }
  habits.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    icon: selectedIcon,
    category: String(data.get("category") || "Personal"),
    events: [],
  });
  if (!saveHabits()) {
    habits.shift();
    return;
  }
  renderHabits();
  dialog.close();
  showToast("Your new habit is ready. Let’s make it stick!");
});
habitList.addEventListener("click", (event) => {
  const logButton = event.target.closest("[data-log]");
  const deleteButton = event.target.closest("[data-delete]");
  if (logButton) {
    const habit = habits.find((item) => item.id === logButton.dataset.log);
    if (!habit) return;
    habit.events.push(localDateKey());
    if (!saveHabits()) {
      habit.events.pop();
      return;
    }
    renderHabits();
    showToast("Nice work — another small win!");
  }
  if (deleteButton) {
    const index = habits.findIndex((item) => item.id === deleteButton.dataset.delete);
    if (index < 0) return;
    const [removed] = habits.splice(index, 1);
    if (!saveHabits()) {
      habits.splice(index, 0, removed);
      return;
    }
    renderHabits();
    showToast("Habit deleted.");
  }
});

updateDate();
renderHabits();
