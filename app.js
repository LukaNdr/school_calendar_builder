const DAYS = ["ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი"];
const STORAGE_KEY = "school-calendar-builder-draft-v1";

const state = {
  classes: [],
  teachers: [],
  selectedSubjects: [
    { name: "ქართული", weeklyLessons: 7 },
    { name: "მათემატიკა", weeklyLessons: 7 },
    { name: "ინგლისური", weeklyLessons: 6 },
  ],
  selectedTeacherSubjects: [{ name: "ქართული", classes: [] }],
  selectedTeacherAvailability: DAYS.map((day) => ({ day, from: "09:00", to: "17:00" })),
  selectedBulkClasses: [],
  classSectionShifts: {},
  generatedVariants: [],
  selectedVariantIndex: 0,
  editingClassIndex: null,
  editingTeacherIndex: null,
};

const $ = (id) => document.getElementById(id);
let isRestoringDraft = false;

function normalizeList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function migrateTeacherAvailability(teacher) {
  if (Array.isArray(teacher.availability)) return teacher;

  const days = Array.isArray(teacher.days) ? teacher.days : [];
  const from = teacher.from || "09:00";
  const to = teacher.to || "17:00";

  return {
    ...teacher,
    availability: days.map((day) => ({ day, from, to })),
  };
}

function availabilitySummary(availability) {
  const items = Array.isArray(availability) ? availability : [];
  if (items.length === 0) return "დრო არ არის მითითებული";

  return DAYS.map((day) => {
    const ranges = items.filter((item) => item.day === day).map((item) => `${item.from}-${item.to}`);
    return ranges.length > 0 ? `${day}: ${ranges.join(", ")}` : "";
  })
    .filter(Boolean)
    .join("; ");
}

function getActivePanelId() {
  return document.querySelector(".panel.active")?.id || "classesPanel";
}

function collectFormDraft() {
  return {
    activePanelId: getActivePanelId(),
    classGrade: $("classGrade").value,
    classSection: $("classSection").value,
    classShift: $("classShift").value,
    classMinLessons: $("classMinLessons").value,
    classMaxLessons: $("classMaxLessons").value,
    subjectDraft: $("subjectDraft").value,
    subjectSourceClass: $("subjectSourceClass").value,
    bulkSubjectName: $("bulkSubjectName").value,
    bulkSubjectWeekly: $("bulkSubjectWeekly").value,
    shift2Enabled: $("shift2Enabled").checked,
    shift3Enabled: $("shift3Enabled").checked,
    shift1Start: $("shift1Start").value,
    shift2Start: $("shift2Start").value,
    shift3Start: $("shift3Start").value,
    lessonDuration: $("lessonDuration").value,
    breakDuration: $("breakDuration").value,
    breakMode: document.querySelector('input[name="breakMode"]:checked')?.value || "constant",
    customBreaks: $("customBreaks").value,
    teacherName: $("teacherName").value,
    teacherSubjectDraft: $("teacherSubjectDraft").value,
    teacherAvailabilityDay: $("teacherAvailabilityDay").value,
    teacherAvailabilityFrom: $("teacherAvailabilityFrom").value,
    teacherAvailabilityTo: $("teacherAvailabilityTo").value,
  };
}

function persistDraft() {
  if (isRestoringDraft) return;

  const payload = {
    savedAt: new Date().toISOString(),
    classes: state.classes,
    teachers: state.teachers,
    selectedSubjects: state.selectedSubjects,
    selectedTeacherSubjects: state.selectedTeacherSubjects,
    selectedTeacherAvailability: state.selectedTeacherAvailability,
    selectedBulkClasses: state.selectedBulkClasses,
    classSectionShifts: state.classSectionShifts,
    generatedVariants: state.generatedVariants,
    selectedVariantIndex: state.selectedVariantIndex,
    editingClassIndex: state.editingClassIndex,
    editingTeacherIndex: state.editingTeacherIndex,
    form: collectFormDraft(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Draft could not be saved.", error);
  }
}

function restoreSavedDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    isRestoringDraft = true;
    const payload = JSON.parse(raw);
    const form = payload.form || {};

    state.classes = Array.isArray(payload.classes) ? payload.classes : [];
    state.teachers = Array.isArray(payload.teachers) ? payload.teachers : [];
    state.selectedSubjects = Array.isArray(payload.selectedSubjects) ? payload.selectedSubjects : state.selectedSubjects;
    state.selectedTeacherSubjects = Array.isArray(payload.selectedTeacherSubjects)
      ? payload.selectedTeacherSubjects
      : state.selectedTeacherSubjects;
    state.selectedTeacherAvailability = Array.isArray(payload.selectedTeacherAvailability)
      ? payload.selectedTeacherAvailability
      : state.selectedTeacherAvailability;
    state.selectedBulkClasses = Array.isArray(payload.selectedBulkClasses) ? payload.selectedBulkClasses : [];
    state.classSectionShifts = payload.classSectionShifts && typeof payload.classSectionShifts === "object" ? payload.classSectionShifts : {};
    state.teachers = state.teachers.map(migrateTeacherAvailability);
    state.generatedVariants = Array.isArray(payload.generatedVariants)
      ? payload.generatedVariants.filter((variant) => variant.unresolved?.length === 0 && variant.dailyShortages?.length === 0)
      : [];
    state.selectedVariantIndex = Number.isInteger(payload.selectedVariantIndex) ? payload.selectedVariantIndex : 0;
    state.editingClassIndex = Number.isInteger(payload.editingClassIndex) ? payload.editingClassIndex : null;
    state.editingTeacherIndex = Number.isInteger(payload.editingTeacherIndex) ? payload.editingTeacherIndex : null;

    $("classGrade").value = form.classGrade ?? $("classGrade").value;
    $("classSection").value = form.classSection ?? $("classSection").value;
    $("classShift").value = form.classShift ?? $("classShift").value;
    $("classMinLessons").value = form.classMinLessons ?? $("classMinLessons").value;
    $("classMaxLessons").value = form.classMaxLessons ?? $("classMaxLessons").value;
    $("subjectDraft").value = form.subjectDraft ?? "";
    $("subjectSourceClass").value = form.subjectSourceClass ?? "";
    $("bulkSubjectName").value = form.bulkSubjectName ?? "";
    $("bulkSubjectWeekly").value = form.bulkSubjectWeekly ?? "3";
    $("shift2Enabled").checked = form.shift2Enabled ?? $("shift2Enabled").checked;
    $("shift3Enabled").checked = form.shift3Enabled ?? $("shift3Enabled").checked;
    $("shift1Start").value = form.shift1Start ?? $("shift1Start").value;
    $("shift2Start").value = form.shift2Start ?? $("shift2Start").value;
    $("shift3Start").value = form.shift3Start ?? $("shift3Start").value;
    $("lessonDuration").value = form.lessonDuration ?? $("lessonDuration").value;
    $("breakDuration").value = form.breakDuration ?? $("breakDuration").value;
    $("customBreaks").value = form.customBreaks ?? $("customBreaks").value;
    $("teacherName").value = form.teacherName ?? $("teacherName").value;
    $("teacherSubjectDraft").value = form.teacherSubjectDraft ?? "";
    $("teacherAvailabilityDay").value = form.teacherAvailabilityDay ?? "ყველა";
    $("teacherAvailabilityFrom").value = form.teacherAvailabilityFrom ?? form.teacherFrom ?? $("teacherAvailabilityFrom").value;
    $("teacherAvailabilityTo").value = form.teacherAvailabilityTo ?? form.teacherTo ?? $("teacherAvailabilityTo").value;

    const breakMode = form.breakMode === "custom" ? "custom" : "constant";
    document.querySelector(`input[name="breakMode"][value="${breakMode}"]`).checked = true;

    if (!Array.isArray(payload.selectedTeacherAvailability) && Array.isArray(form.teacherDays)) {
      state.selectedTeacherAvailability = form.teacherDays.map((day) => ({
        day,
        from: form.teacherFrom ?? "09:00",
        to: form.teacherTo ?? "17:00",
      }));
    }

    if (!state.classes[state.editingClassIndex]) state.editingClassIndex = null;
    if (!state.teachers[state.editingTeacherIndex]) state.editingTeacherIndex = null;

    if (form.activePanelId && $(form.activePanelId)) {
      document.querySelectorAll(".step-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.panel === form.activePanelId);
      });
      document.querySelectorAll(".panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === form.activePanelId);
      });
    }

    return true;
  } catch (error) {
    console.warn("Saved draft could not be restored.", error);
    return false;
  } finally {
    isRestoringDraft = false;
  }
}

function className(grade, section) {
  return `${grade}${section.trim()}`;
}

function parseClassSections(value) {
  const sections = value
    .split(/[,،]/)
    .map((section) => section.trim())
    .filter(Boolean);
  return sections.length > 0 ? Array.from(new Set(sections)) : [""];
}

function suggestedNextSection(section) {
  const sections = ["ა", "ბ", "გ", "დ", "ე", "ვ", "ზ", "თ"];
  const currentIndex = sections.indexOf(section.trim());
  return currentIndex >= 0 && currentIndex < sections.length - 1 ? sections[currentIndex + 1] : "ა";
}

function renderSectionShiftOptions() {
  const sections = parseClassSections($("classSection").value);
  const isBatch = sections.length > 1 && state.editingClassIndex === null;
  $("sectionShiftPanel").classList.toggle("hidden", !isBatch);
  if (!isBatch) {
    $("sectionShiftOptions").innerHTML = "";
    return;
  }

  const activeShifts = getActiveShifts();
  const shiftLabels = { 1: "პირველი სმენა", 2: "მეორე სმენა", 3: "მესამე სმენა" };
  const currentSections = new Set(sections);
  Object.keys(state.classSectionShifts).forEach((section) => {
    if (!currentSections.has(section)) delete state.classSectionShifts[section];
  });

  $("sectionShiftOptions").innerHTML = sections
    .map((section) => {
      const savedShift = state.classSectionShifts[section];
      const selectedShift = activeShifts.includes(savedShift) ? savedShift : $("classShift").value;
      return `
        <label class="section-shift-row">
          <span>${className($("classGrade").value, section)}</span>
          <select data-section-shift="${section}">
            ${activeShifts
              .map(
                (shift) => `<option value="${shift}" ${shift === selectedShift ? "selected" : ""}>${shiftLabels[shift]}</option>`,
              )
              .join("")}
          </select>
        </label>
      `;
    })
    .join("");
}

function getClassShiftForSection(section) {
  const activeShifts = getActiveShifts();
  const savedShift = state.classSectionShifts[section];
  return activeShifts.includes(savedShift) ? savedShift : $("classShift").value;
}

function addSubject(subject) {
  const normalized = subject.trim();
  if (!normalized) return;

  const exists = state.selectedSubjects.some((item) => item.name.toLowerCase() === normalized.toLowerCase());
  if (!exists) state.selectedSubjects.push({ name: normalized, weeklyLessons: 1 });

  $("subjectDraft").value = "";
  renderSubjectChips();
  persistDraft();
}

function renderSubjectChips() {
  $("subjectChips").innerHTML = state.selectedSubjects
    .map(
      (subject, index) => `
        <span class="chip subject-chip">
          <span class="subject-chip-name">${subject.name}</span>
          <span class="subject-chip-controls">
            <label class="chip-count">
              კვირაში
              <input type="number" min="1" max="20" value="${subject.weeklyLessons}" data-subject-count="${index}" />
            </label>
            <button type="button" aria-label="${subject.name} წაშლა" data-remove-subject="${index}">×</button>
          </span>
        </span>
      `,
    )
    .join("");
}

function renderSubjectSourceOptions() {
  const select = $("subjectSourceClass");
  const currentValue = select.value;

  if (state.classes.length === 0) {
    select.innerHTML = `<option value="">ჯერ დაამატე კლასი</option>`;
    select.disabled = true;
    $("copySubjectsBtn").disabled = true;
    return;
  }

  select.disabled = false;
  $("copySubjectsBtn").disabled = false;
  select.innerHTML = `
    <option value="">აირჩიე კლასი</option>
    ${state.classes.map((classItem, index) => `<option value="${index}">${classItem.name}</option>`).join("")}
  `;
  select.value = state.classes[currentValue] ? currentValue : "";
}

function copySubjectsFromClass() {
  const index = Number($("subjectSourceClass").value);
  const classItem = state.classes[index];

  if (!classItem) {
    showMessages([{ type: "error", text: "საგნების გადმოსატანად ჯერ აირჩიე კლასი." }]);
    return;
  }

  state.selectedSubjects = classItem.subjects.map((subject) => ({ ...subject }));
  renderSubjectChips();
  showMessages([{ type: "ok", text: `${classItem.name} კლასის საგნები გადმოტანილია.` }]);
  persistDraft();
}

function clearSelectedSubjects() {
  state.selectedSubjects = [];
  renderSubjectChips();
  persistDraft();
}

function renderBulkClassOptions() {
  const validClassNames = new Set(state.classes.map((classItem) => classItem.name));
  state.selectedBulkClasses = state.selectedBulkClasses.filter((className) => validClassNames.has(className));

  if (state.classes.length === 0) {
    $("bulkClassOptions").innerHTML = `<p class="empty-note">ჯერ დაამატე კლასები.</p>`;
    $("selectAllBulkClassesBtn").disabled = true;
    $("addBulkSubjectBtn").disabled = true;
    return;
  }

  $("selectAllBulkClassesBtn").disabled = false;
  $("addBulkSubjectBtn").disabled = false;
  $("selectAllBulkClassesBtn").textContent =
    state.selectedBulkClasses.length === state.classes.length ? "მონიშვნის მოხსნა" : "ყველას მონიშვნა";
  $("bulkClassOptions").innerHTML = state.classes
    .map(
      (classItem) => `
        <label class="class-option">
          <input type="checkbox" value="${classItem.name}" data-bulk-class ${
            state.selectedBulkClasses.includes(classItem.name) ? "checked" : ""
          } />
          <span>${classItem.name}</span>
        </label>
      `,
    )
    .join("");
}

function toggleAllBulkClasses() {
  state.selectedBulkClasses =
    state.selectedBulkClasses.length === state.classes.length ? [] : state.classes.map((classItem) => classItem.name);
  renderBulkClassOptions();
  persistDraft();
}

function addSubjectToSelectedClasses() {
  const name = $("bulkSubjectName").value.trim();
  const weeklyLessons = Number($("bulkSubjectWeekly").value);

  if (!name || !Number.isFinite(weeklyLessons) || weeklyLessons < 1) {
    showMessages([{ type: "error", text: "მიუთითე საგნის სახელი და სწორი კვირეული რაოდენობა." }]);
    return;
  }

  if (state.selectedBulkClasses.length === 0) {
    showMessages([{ type: "error", text: "მონიშნე მინიმუმ ერთი კლასი." }]);
    return;
  }

  state.classes.forEach((classItem) => {
    if (!state.selectedBulkClasses.includes(classItem.name)) return;
    const existingSubject = classItem.subjects.find((subject) => subject.name.toLowerCase() === name.toLowerCase());
    if (existingSubject) existingSubject.weeklyLessons = weeklyLessons;
    else classItem.subjects.push({ name, weeklyLessons });
  });

  const updatedCount = state.selectedBulkClasses.length;
  $("bulkSubjectName").value = "";
  state.selectedBulkClasses = [];
  renderClasses();
  showMessages([{ type: "ok", text: `${name} დაემატა ${updatedCount} კლასს.` }]);
  persistDraft();
}

function addTeacherSubject(subject) {
  const normalized = subject.trim();
  if (!normalized) return;

  const exists = state.selectedTeacherSubjects.some((item) => item.name.toLowerCase() === normalized.toLowerCase());
  if (!exists) state.selectedTeacherSubjects.push({ name: normalized, classes: [] });

  $("teacherSubjectDraft").value = "";
  renderTeacherSubjectChips();
  persistDraft();
}

function renderTeacherSubjectChips() {
  $("teacherSubjectChips").innerHTML = state.selectedTeacherSubjects
    .map(
      (subject, index) => `
        <div class="teacher-assignment-card">
          <div class="teacher-assignment-head">
            <strong>${subject.name}</strong>
            <button type="button" aria-label="${subject.name} წაშლა" data-remove-teacher-subject="${index}">×</button>
          </div>
          <p>რომელ კლასებს ასწავლის ამ საგანს?</p>
          <div class="class-options compact">
            ${
              state.classes.length === 0
                ? `<p class="empty-note">ჯერ დაამატე კლასები პირველ გვერდზე.</p>`
                : state.classes
                    .map(
                      (classItem) => `
                        <label class="class-option">
                          <input type="checkbox" name="teacherSubjectClass" value="${classItem.name}" data-teacher-subject-index="${index}" ${
                            subject.classes.includes(classItem.name) ? "checked" : ""
                          } />
                          <span>${classItem.name}</span>
                        </label>
                      `,
                    )
                    .join("")
            }
          </div>
        </div>
      `,
    )
    .join("");
}

function renderTeacherAvailabilityList() {
  const list = $("teacherAvailabilityList");
  if (state.selectedTeacherAvailability.length === 0) {
    list.innerHTML = `<p class="empty-note">ჯერ დაამატე მინიმუმ ერთი თავისუფალი დრო.</p>`;
    return;
  }

  list.innerHTML = state.selectedTeacherAvailability
    .map(
      (item, index) => `
        <span class="availability-chip">
          <strong>${item.day}</strong>
          <span>${item.from}-${item.to}</span>
          <button type="button" aria-label="${item.day} ${item.from}-${item.to} წაშლა" data-remove-availability="${index}">×</button>
        </span>
      `,
    )
    .join("");
}

function addTeacherAvailability() {
  const selectedDay = $("teacherAvailabilityDay").value;
  const from = $("teacherAvailabilityFrom").value.trim();
  const to = $("teacherAvailabilityTo").value.trim();

  if (!isValidTime(from) || !isValidTime(to)) {
    showMessages([{ type: "error", text: "თავისუფალი დრო მიუთითე 24-საათიან ფორმატში, მაგალითად 09:00 ან 15:30." }]);
    return;
  }

  if (timeToMinutes(from) >= timeToMinutes(to)) {
    showMessages([{ type: "error", text: "თავისუფალი დროის დასაწყისი დასრულებაზე ადრე უნდა იყოს." }]);
    return;
  }

  const days = selectedDay === "ყველა" ? DAYS : [selectedDay];
  days.forEach((day) => {
    const exists = state.selectedTeacherAvailability.some((item) => item.day === day && item.from === from && item.to === to);
    if (!exists) state.selectedTeacherAvailability.push({ day, from, to });
  });

  state.selectedTeacherAvailability.sort((first, second) => DAYS.indexOf(first.day) - DAYS.indexOf(second.day) || timeToMinutes(first.from) - timeToMinutes(second.from));
  renderTeacherAvailabilityList();
  persistDraft();
}

function getActiveShifts() {
  const shifts = ["1"];
  if ($("shift2Enabled").checked) shifts.push("2");
  if ($("shift3Enabled").checked) shifts.push("3");
  return shifts;
}

function updateShiftAvailability() {
  const activeShifts = getActiveShifts();

  Array.from($("classShift").options).forEach((option) => {
    const isActive = activeShifts.includes(option.value);
    option.disabled = !isActive;
    option.hidden = !isActive;
  });

  if (!activeShifts.includes($("classShift").value)) {
    $("classShift").value = "1";
  }

  ["2", "3"].forEach((shift) => {
    const enabled = activeShifts.includes(shift);
    const input = $(`shift${shift}Start`);
    const wrapper = document.querySelector(`[data-shift-setting="${shift}"]`);
    input.disabled = !enabled;
    wrapper.classList.toggle("disabled", !enabled);
  });
  renderSectionShiftOptions();
}

function updateBreakMode() {
  const mode = document.querySelector('input[name="breakMode"]:checked').value;
  const isCustom = mode === "custom";
  const constantBreakInput = $("breakDuration");
  $("customBreakPanel").classList.toggle("hidden", !isCustom);
  constantBreakInput.disabled = isCustom;
  constantBreakInput.closest("label").classList.toggle("disabled", isCustom);
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [hours, minutes] = time.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function minutesToTime(total) {
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getSelectedTeacherClasses() {
  return Array.from(document.querySelectorAll('input[name="teacherClass"]:checked')).map((input) => input.value);
}

function updateSummary() {
  const subjects = new Set(state.classes.flatMap((item) => item.subjects.map((subject) => subject.name)));
  $("summaryClasses").textContent = `${state.classes.length} კლასი`;
  $("summaryTeachers").textContent = `${state.teachers.length} მასწავლებელი`;
  $("summarySubjects").textContent = `${subjects.size} საგანი`;
}

function setClassEditingMode(index) {
  state.editingClassIndex = index;
  const isEditing = index !== null;
  $("addClassBtn").textContent = isEditing ? "ცვლილების შენახვა" : "+ კლასის დამატება";
  $("cancelClassEditBtn").classList.toggle("hidden", !isEditing);
}

function setTeacherEditingMode(index) {
  state.editingTeacherIndex = index;
  const isEditing = index !== null;
  $("addTeacherBtn").textContent = isEditing ? "ცვლილების შენახვა" : "+ მასწავლებლის დამატება";
  $("cancelTeacherEditBtn").classList.toggle("hidden", !isEditing);
}

function resetClassForm() {
  $("classGrade").value = "1";
  $("classSection").value = "";
  $("classShift").value = "1";
  $("classMinLessons").value = "4";
  $("classMaxLessons").value = "6";
  state.classSectionShifts = {};
  state.selectedSubjects = [
    { name: "ქართული", weeklyLessons: 7 },
    { name: "მათემატიკა", weeklyLessons: 7 },
    { name: "ინგლისური", weeklyLessons: 6 },
  ];
  setClassEditingMode(null);
  renderSubjectChips();
  updateLessonRangePreview();
  updateShiftAvailability();
  persistDraft();
}

function resetTeacherForm() {
  $("teacherName").value = "ნინო მასწავლებელი";
  state.selectedTeacherSubjects = [{ name: "ქართული", classes: [] }];
  state.selectedTeacherAvailability = DAYS.map((day) => ({ day, from: "09:00", to: "17:00" }));
  $("teacherAvailabilityDay").value = "ყველა";
  $("teacherAvailabilityFrom").value = "09:00";
  $("teacherAvailabilityTo").value = "17:00";
  setTeacherEditingMode(null);
  renderTeacherSubjectChips();
  renderTeacherAvailabilityList();
  persistDraft();
}

function clearAllData() {
  const shouldClear = window.confirm("ყველა კლასი, მასწავლებელი და შენახული ცხრილი წაიშლება. ნამდვილად გინდა თავიდან დაწყება?");
  if (!shouldClear) return;

  localStorage.removeItem(STORAGE_KEY);
  state.classes = [];
  state.teachers = [];
  state.selectedBulkClasses = [];
  state.classSectionShifts = {};
  state.generatedVariants = [];
  state.selectedVariantIndex = 0;
  resetClassForm();
  resetTeacherForm();
  $("scheduleOutput").innerHTML = "";
  $("variantPicker").classList.add("hidden");
  $("variantPicker").innerHTML = "";
  renderClasses();
  renderTeachers();
  showMessages([{ type: "ok", text: "ყველაფერი გასუფთავდა. შეგიძლია თავიდან დაიწყო." }]);
  localStorage.removeItem(STORAGE_KEY);
}

function renderClasses() {
  $("classesTable").innerHTML = state.classes
    .map(
      (item, index) => `
        <tr>
          <td><span class="cell-title">${item.name}</span></td>
          <td><span class="pill">${item.shift} სმენა</span></td>
          <td><span class="pill blue">${item.minLessonsPerDay}-${item.maxLessonsPerDay}</span></td>
          <td>
            <div class="subject-list">
              ${item.subjects.map((subject) => `<span class="subject-mini">${subject.name} · ${subject.weeklyLessons}</span>`).join("")}
            </div>
          </td>
          <td>
            <div class="row-actions">
              <button type="button" data-edit-class="${index}">შეცვლა</button>
              <button type="button" data-duplicate-class="${index}">დუბლირება</button>
              <button class="danger" type="button" data-remove-class="${index}">წაშლა</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
  updateSummary();
  renderSubjectSourceOptions();
  renderBulkClassOptions();
  renderTeacherClassOptions();
}

function renderTeacherClassOptions() {
  state.selectedTeacherSubjects.forEach((subject) => {
    subject.classes = subject.classes.filter((className) => state.classes.some((classItem) => classItem.name === className));
  });
  renderTeacherSubjectChips();
}

function renderTeachers() {
  $("teachersTable").innerHTML = state.teachers
    .map(
      (item, index) => `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td>
            <div class="subject-list">
              ${item.assignments
                .map((assignment) => `<span class="subject-mini">${assignment.name}: ${assignment.classes.join(", ")}</span>`)
                .join("")}
            </div>
          </td>
          <td>${Array.from(new Set(item.assignments.flatMap((assignment) => assignment.classes))).join(", ")}</td>
          <td>${availabilitySummary(item.availability)}</td>
          <td>
            <div class="row-actions">
              <button type="button" data-edit-teacher="${index}">შეცვლა</button>
              <button class="danger" type="button" data-remove-teacher="${index}">წაშლა</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
  updateSummary();
}

function addClass() {
  const grade = $("classGrade").value.trim();
  const sections = parseClassSections($("classSection").value);
  const subjects = state.selectedSubjects.map((subject) => ({ ...subject }));
  const minLessonsPerDay = Number($("classMinLessons").value);
  const maxLessonsPerDay = Number($("classMaxLessons").value);

  if (!grade || subjects.length === 0) {
    showMessages([{ type: "error", text: "კლასის დამატებისთვის შეავსე კლასი და დაამატე მინიმუმ ერთი საგანი." }]);
    return;
  }

  if (subjects.some((subject) => !Number.isFinite(subject.weeklyLessons) || subject.weeklyLessons < 1)) {
    showMessages([{ type: "error", text: "თითოეული საგნის კვირეული რაოდენობა უნდა იყოს მინიმუმ 1." }]);
    return;
  }

  if (state.editingClassIndex !== null && sections.length > 1) {
    showMessages([{ type: "error", text: "რედაქტირებისას მხოლოდ ერთი ქვეკლასი მიუთითე." }]);
    return;
  }

  if (!minLessonsPerDay || !maxLessonsPerDay || minLessonsPerDay < 1 || maxLessonsPerDay < minLessonsPerDay) {
    showMessages([{ type: "error", text: "კლასისთვის დღიური მინიმუმი და მაქსიმუმი სწორად მიუთითე." }]);
    return;
  }

  const classItems = sections.map((section) => ({
    name: className(grade, section),
    grade,
    section,
    shift: getClassShiftForSection(section),
    minLessonsPerDay,
    maxLessonsPerDay,
    subjects: subjects.map((subject) => ({ ...subject })),
  }));

  const duplicateNames = classItems
    .filter((classItem) =>
      state.classes.some((item, index) => item.name === classItem.name && index !== state.editingClassIndex),
    )
    .map((classItem) => classItem.name);
  if (duplicateNames.length > 0) {
    showMessages([{ type: "error", text: `${duplicateNames.join(", ")} უკვე დამატებულია.` }]);
    return;
  }

  if (state.editingClassIndex !== null) {
    const classData = classItems[0];
    const name = classData.name;
    const oldName = state.classes[state.editingClassIndex].name;
    state.classes[state.editingClassIndex] = classData;
    if (oldName !== name) {
      state.teachers.forEach((teacher) => {
        teacher.assignments.forEach((assignment) => {
          assignment.classes = assignment.classes.map((className) => (className === oldName ? name : className));
        });
      });
    }
    showMessages([{ type: "ok", text: `${name} განახლდა.` }]);
    setClassEditingMode(null);
  } else {
    state.classes.push(...classItems);
    showMessages([
      {
        type: "ok",
        text:
          classItems.length > 1
            ? `${classItems.map((classItem) => classItem.name).join(", ")} კლასები ერთად დაემატა.`
            : `${classItems[0].name} დაემატა.`,
      },
    ]);
  }

  renderClasses();
  renderTeachers();
  persistDraft();
}

function duplicateClass(index) {
  const source = state.classes[index];
  if (!source) return;

  const section = window.prompt(
    `${source.name} კლასის ასლისთვის მიუთითე ახალი ქვეკლასი:`,
    suggestedNextSection(source.section),
  );
  if (section === null) return;

  const normalizedSection = section.trim();
  if (!normalizedSection || normalizedSection.includes(",") || normalizedSection.includes("،")) {
    showMessages([{ type: "error", text: "დუბლირებისთვის მიუთითე ერთი ქვეკლასი, მაგალითად ბ." }]);
    return;
  }

  const name = className(source.grade, normalizedSection);
  if (state.classes.some((classItem) => classItem.name === name)) {
    showMessages([{ type: "error", text: `${name} უკვე დამატებულია.` }]);
    return;
  }

  state.classes.splice(index + 1, 0, {
    ...source,
    name,
    section: normalizedSection,
    subjects: source.subjects.map((subject) => ({ ...subject })),
  });
  renderClasses();
  renderTeachers();
  showMessages([{ type: "ok", text: `${source.name}-ის ასლი შეიქმნა როგორც ${name}.` }]);
  persistDraft();
}

function addTeacher() {
  const name = $("teacherName").value.trim();
  const assignments = state.selectedTeacherSubjects.map((subject) => ({
    name: subject.name,
    classes: [...subject.classes],
  }));
  const classes = Array.from(new Set(assignments.flatMap((assignment) => assignment.classes)));
  const availability = state.selectedTeacherAvailability.map((item) => ({ ...item }));

  if (!name || assignments.length === 0 || classes.length === 0 || availability.length === 0) {
    showMessages([{ type: "error", text: "მასწავლებლის დამატებისთვის ყველა ველი შეავსე." }]);
    return;
  }

  if (assignments.some((assignment) => assignment.classes.length === 0)) {
    showMessages([{ type: "error", text: "თითოეულ საგანთან მონიშნე მინიმუმ ერთი კლასი." }]);
    return;
  }

  if (availability.some((item) => !DAYS.includes(item.day) || !isValidTime(item.from) || !isValidTime(item.to))) {
    showMessages([{ type: "error", text: "მასწავლებლის თავისუფალი დრო მიუთითე 24-საათიან ფორმატში, მაგალითად 09:00 ან 15:30." }]);
    return;
  }

  if (availability.some((item) => timeToMinutes(item.from) >= timeToMinutes(item.to))) {
    showMessages([{ type: "error", text: "მასწავლებლის თავისუფალი დროის დასაწყისი დასრულებაზე ადრე უნდა იყოს." }]);
    return;
  }

  const teacherData = { name, assignments, availability };

  if (state.editingTeacherIndex !== null) {
    state.teachers[state.editingTeacherIndex] = teacherData;
    showMessages([{ type: "ok", text: `${name} განახლდა.` }]);
    setTeacherEditingMode(null);
  } else {
    state.teachers.push(teacherData);
  }

  renderTeachers();
  persistDraft();
}

function editClass(index) {
  const item = state.classes[index];
  if (!item) return;

  $("classGrade").value = item.grade;
  $("classSection").value = item.section;
  $("classShift").value = item.shift;
  $("classMinLessons").value = item.minLessonsPerDay;
  $("classMaxLessons").value = item.maxLessonsPerDay;
  state.selectedSubjects = item.subjects.map((subject) => ({ ...subject }));
  state.classSectionShifts = {};
  setClassEditingMode(index);
  renderSubjectChips();
  updateLessonRangePreview();
  updateShiftAvailability();
  $("classGrade").focus();
  showMessages([{ type: "warn", text: `${item.name} ჩაიტვირთა შესაცვლელად. დასრულებისას დააჭირე „ცვლილების შენახვა“.` }]);
  persistDraft();
}

function editTeacher(index) {
  const item = state.teachers[index];
  if (!item) return;

  $("teacherName").value = item.name;
  state.selectedTeacherSubjects = item.assignments.map((assignment) => ({
    name: assignment.name,
    classes: [...assignment.classes],
  }));
  const teacher = migrateTeacherAvailability(item);
  state.selectedTeacherAvailability = teacher.availability.map((availability) => ({ ...availability }));
  $("teacherAvailabilityDay").value = "ყველა";
  $("teacherAvailabilityFrom").value = state.selectedTeacherAvailability[0]?.from || "09:00";
  $("teacherAvailabilityTo").value = state.selectedTeacherAvailability[0]?.to || "17:00";
  setTeacherEditingMode(index);
  renderTeacherSubjectChips();
  renderTeacherAvailabilityList();
  $("teacherName").focus();
  showMessages([{ type: "warn", text: `${item.name} ჩაიტვირთა შესაცვლელად. დასრულებისას დააჭირე „ცვლილების შენახვა“.` }]);
  persistDraft();
}

function getSettings() {
  const breakMode = document.querySelector('input[name="breakMode"]:checked').value;

  return {
    shiftStarts: {
      1: $("shift1Start").value,
      2: $("shift2Start").value,
      3: $("shift3Start").value,
    },
    activeShifts: getActiveShifts(),
    lessonDuration: Number($("lessonDuration").value),
    breakDuration: Number($("breakDuration").value),
    breakMode,
    customBreaks: normalizeList($("customBreaks").value).map(Number),
  };
}

function getBreakAfterLesson(settings, lesson) {
  if (settings.breakMode === "constant") return settings.breakDuration;
  const customBreak = settings.customBreaks[lesson - 1];
  return Number.isFinite(customBreak) ? customBreak : 0;
}

function buildSlots(classItem, settings) {
  let slotStart = timeToMinutes(settings.shiftStarts[classItem.shift]);
  const slots = [];

  for (let lesson = 1; lesson <= classItem.maxLessonsPerDay; lesson += 1) {
    slots.push({
      lesson,
      start: slotStart,
      end: slotStart + settings.lessonDuration,
      label: `${minutesToTime(slotStart)}-${minutesToTime(slotStart + settings.lessonDuration)}`,
    });
    slotStart += settings.lessonDuration + getBreakAfterLesson(settings, lesson);
  }

  return slots;
}

function teacherCanTeach(teacher, classItem, subject, day, slot) {
  const availability = migrateTeacherAvailability(teacher).availability;

  return (
    teacher.assignments.some(
      (assignment) =>
        assignment.name.toLowerCase() === subject.toLowerCase() && assignment.classes.includes(classItem.name),
    ) &&
    availability.some(
      (range) =>
        range.day === day &&
        timeToMinutes(range.from) <= slot.start &&
        timeToMinutes(range.to) >= slot.end,
    )
  );
}

function rotate(items, amount) {
  if (items.length === 0) return items;
  const offset = amount % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function createLessonRequests(variantIndex = 0) {
  const classes = variantIndex % 2 === 0 ? state.classes : [...state.classes].reverse();

  return classes.flatMap((classItem, classIndex) =>
    rotate(classItem.subjects, variantIndex + classIndex).flatMap((subject) =>
      Array.from({ length: subject.weeklyLessons }, () => ({
        className: classItem.name,
        subject: subject.name,
        weeklyLessons: subject.weeklyLessons,
      })),
    ),
  );
}

function generateSchedule() {
  const settings = getSettings();
  const errors = validateBeforeGenerate(settings);

  if (errors.length > 0) {
    showMessages(errors.map((text) => ({ type: "error", text })));
    $("scheduleOutput").innerHTML = "";
    $("variantPicker").classList.add("hidden");
    $("variantPicker").innerHTML = "";
    persistDraft();
    return;
  }

  const variants = [];
  const seen = new Set();

  for (let variantIndex = 0; variantIndex < 12; variantIndex += 1) {
    const result = buildScheduleVariant(settings, variantIndex);
    const isValidVariant = result.unresolved.length === 0 && result.dailyShortages.length === 0;
    if (!isValidVariant) continue;

    const signature = scheduleSignature(result.schedule);
    if (seen.has(signature)) continue;
    seen.add(signature);
    variants.push({ ...result, variantIndex });
    if (variants.length === 5) break;
  }

  state.generatedVariants = variants;
  state.selectedVariantIndex = 0;

  if (variants.length === 0) {
    showMessages([
      {
        type: "error",
        text: "ამ მონაცემებით სრულად გამართული ცხრილი ვერ შეიქმნა. შეცვალე მასწავლებლების თავისუფალი დრო, დაამატე მასწავლებელი ან შეცვალე კლასის დღიური ლიმიტები.",
      },
    ]);
    $("scheduleOutput").innerHTML = "";
    renderVariantPicker();
    persistDraft();
    return;
  }

  renderVariantPicker();
  showVariant(0);
  persistDraft();
}

function buildScheduleVariant(settings, variantIndex) {
  const schedule = Object.fromEntries(
    state.classes.map((item) => [
      item.name,
      {
        classItem: item,
        days: Object.fromEntries(DAYS.map((day) => [day, []])),
      },
    ]),
  );
  const teacherBusy = new Set();
  const requests = createLessonRequests(variantIndex);
  const unresolved = [];

  for (const request of requests) {
    const classItem = state.classes.find((item) => item.name === request.className);
    const slots = buildSlots(classItem, settings);
    let placed = false;

    const dayOrder = rotate(DAYS, variantIndex + request.subject.length).sort(
      (first, second) =>
        schedule[classItem.name].days[first].length - schedule[classItem.name].days[second].length ||
        DAYS.indexOf(first) - DAYS.indexOf(second),
    );

    for (const day of dayOrder) {
      if (placed) break;

      const nextLessonNumber = schedule[classItem.name].days[day].length + 1;
      if (nextLessonNumber > classItem.maxLessonsPerDay) continue;

      const slot = slots[nextLessonNumber - 1];
      const subjectAlreadyToday =
        request.weeklyLessons <= DAYS.length &&
        schedule[classItem.name].days[day].some((lesson) => lesson.subject === request.subject);

      if (subjectAlreadyToday) continue;

      const teacher = state.teachers.find((candidate) => {
        const teacherKey = `${candidate.name}|${day}|${slot.start}`;
        return !teacherBusy.has(teacherKey) && teacherCanTeach(candidate, classItem, request.subject, day, slot);
      });

      if (!teacher) continue;

      schedule[classItem.name].days[day].push({
        lesson: slot.lesson,
        time: slot.label,
        subject: request.subject,
        teacher: teacher.name,
      });
      teacherBusy.add(`${teacher.name}|${day}|${slot.start}`);
      placed = true;
    }

    if (!placed) {
      unresolved.push(`${request.className}: ${request.subject}`);
    }
  }

  const dailyShortages = findDailyShortages(schedule);

  return { schedule, unresolved, dailyShortages };
}

function showVariant(index) {
  const variant = state.generatedVariants[index];
  if (!variant) return;

  state.selectedVariantIndex = index;
  renderVariantPicker();
  showMessages([{ type: "ok", text: `${state.generatedVariants.length} გამართული ვარიანტი შეიქმნა. არჩეულია ვარიანტი ${index + 1}.` }]);

  renderSchedule(variant.schedule);
  persistDraft();
}

function findDailyShortages(schedule) {
  return Object.values(schedule).flatMap(({ classItem, days }) =>
    DAYS.filter((day) => days[day].length < classItem.minLessonsPerDay).map(
      (day) => `${classItem.name} ${day}: ${days[day].length}/${classItem.minLessonsPerDay}`,
    ),
  );
}

function scheduleSignature(schedule) {
  return Object.values(schedule)
    .map(({ classItem, days }) =>
      [
        classItem.name,
        ...DAYS.flatMap((day) => days[day].map((lesson) => `${day}:${lesson.lesson}:${lesson.subject}:${lesson.teacher}`)),
      ].join("|"),
    )
    .join("||");
}

function renderVariantPicker() {
  const picker = $("variantPicker");
  if (state.generatedVariants.length === 0) {
    picker.classList.add("hidden");
    picker.innerHTML = "";
    return;
  }

  picker.classList.remove("hidden");
  picker.innerHTML = `
    <div>
      <h3>აირჩიე სასურველი ვარიანტი</h3>
      <p>ნახე რამდენიმე ცხრილი და დატოვე ის, რომელიც ყველაზე მეტად მოგწონს.</p>
    </div>
    <div class="variant-buttons">
      ${state.generatedVariants
        .map(
          (variant, index) => `
            <button class="${index === state.selectedVariantIndex ? "active" : ""}" data-variant-index="${index}">
              ვარიანტი ${index + 1}
            </button>
          `,
        )
        .join("")}
      <button class="primary" data-keep-variant="true">ამ ვარიანტის დატოვება</button>
    </div>
  `;
}

function keepSelectedVariant() {
  const variant = state.generatedVariants[state.selectedVariantIndex];
  if (!variant) return;

  state.generatedVariants = [variant];
  state.selectedVariantIndex = 0;
  renderVariantPicker();
  renderSchedule(variant.schedule);
  showMessages([{ type: "ok", text: "არჩეული ვარიანტი დატოვებულია." }]);
  persistDraft();
}

function validateBeforeGenerate(settings) {
  const errors = [];

  if (state.classes.length === 0) errors.push("დაამატე მინიმუმ ერთი კლასი.");
  if (state.teachers.length === 0) errors.push("დაამატე მინიმუმ ერთი მასწავლებელი.");
  if (settings.activeShifts.some((shift) => !isValidTime(settings.shiftStarts[shift]))) {
    errors.push("სმენების დროები მიუთითე 24-საათიან ფორმატში, მაგალითად 09:00 ან 14:30.");
  }
  if (!settings.lessonDuration || settings.lessonDuration < 1) errors.push("გაკვეთილის ხანგრძლივობა უნდა იყოს დადებითი რიცხვი.");
  if (settings.breakDuration < 0) errors.push("დასვენება უარყოფითი ვერ იქნება.");
  if (settings.breakMode === "custom") {
    if (settings.customBreaks.length === 0) {
      errors.push("განსხვავებული დასვენებისთვის ჩაწერე მინიმუმ ერთი დრო წუთებში.");
    }
    if (settings.customBreaks.some((duration) => !Number.isFinite(duration) || duration < 0)) {
      errors.push("განსხვავებული დასვენებები უნდა იყოს არაუარყოფითი რიცხვები, მაგალითად 5, 10, 5.");
    }
  }

  for (const teacher of state.teachers) {
    const availability = migrateTeacherAvailability(teacher).availability;
    if (availability.length === 0) {
      errors.push(`${teacher.name} მასწავლებელს თავისუფალი დრო არ აქვს მითითებული.`);
    }
    if (availability.some((item) => !DAYS.includes(item.day) || !isValidTime(item.from) || !isValidTime(item.to))) {
      errors.push(`${teacher.name} მასწავლებლის თავისუფალი დრო არასწორია.`);
    }
    if (availability.some((item) => timeToMinutes(item.from) >= timeToMinutes(item.to))) {
      errors.push(`${teacher.name} მასწავლებლის თავისუფალი დროის დასაწყისი დასრულებაზე ადრე უნდა იყოს.`);
    }
  }

  for (const classItem of state.classes) {
    const weeklyLessonTotal = classItem.subjects.reduce((total, subject) => total + subject.weeklyLessons, 0);

    if (!classItem.minLessonsPerDay || !classItem.maxLessonsPerDay || classItem.minLessonsPerDay > classItem.maxLessonsPerDay) {
      errors.push(`${classItem.name} კლასისთვის დღიური მინ/მაქს ლიმიტი არასწორია.`);
    }

    if (weeklyLessonTotal < classItem.minLessonsPerDay * DAYS.length) {
      errors.push(
        `${classItem.name} კლასს კვირაში ${weeklyLessonTotal} გაკვეთილი აქვს, მაგრამ დღიური მინიმუმისთვის საჭიროა მინიმუმ ${classItem.minLessonsPerDay * DAYS.length}.`,
      );
    }

    if (weeklyLessonTotal > classItem.maxLessonsPerDay * DAYS.length) {
      errors.push(
        `${classItem.name} კლასს კვირაში ${weeklyLessonTotal} გაკვეთილი აქვს, მაგრამ დღიური მაქსიმუმით ეტევა მაქსიმუმ ${classItem.maxLessonsPerDay * DAYS.length}.`,
      );
    }

    if (!settings.activeShifts.includes(classItem.shift)) {
      errors.push(`${classItem.name} კლასს მითითებული აქვს გამორთული სმენა.`);
    }

    for (const subject of classItem.subjects) {
      const hasTeacher = state.teachers.some(
        (teacher) =>
          teacher.assignments.some(
            (assignment) =>
              assignment.name.toLowerCase() === subject.name.toLowerCase() && assignment.classes.includes(classItem.name),
          ),
      );
      if (!hasTeacher) errors.push(`${classItem.name} კლასისთვის საგანს "${subject.name}" არ ჰყავს შესაბამისი მასწავლებელი.`);
    }
  }

  return errors;
}

function showMessages(messages) {
  $("messages").innerHTML = messages
    .map((message) => `<div class="message ${message.type}">${message.text}</div>`)
    .join("");
}

function updateLessonRangePreview() {
  const min = $("classMinLessons").value || "0";
  const max = $("classMaxLessons").value || "0";
  $("lessonRangePreview").textContent = `დღეში ${min}-${max} გაკვეთილი`;
}

function renderSchedule(schedule) {
  $("scheduleOutput").innerHTML = Object.values(schedule)
    .map(({ classItem, days }) => {
      const rows = DAYS.map((day) => {
        const lessons = days[day].sort((a, b) => a.lesson - b.lesson);
        return `
          <tr>
            <td><strong>${day}</strong></td>
            ${Array.from({ length: classItem.maxLessonsPerDay }, (_, index) => {
              const lesson = lessons.find((item) => item.lesson === index + 1);
              return `<td>${
                lesson
                  ? `<div class="slot"><strong>${lesson.subject}</strong><span>${lesson.time}</span><span>${lesson.teacher}</span></div>`
                  : ""
              }</td>`;
            }).join("")}
          </tr>
        `;
      }).join("");

      return `
        <article class="class-schedule">
          <div class="class-title">
            <h3>${classItem.name}</h3>
            <span>${classItem.shift} სმენა · ${classItem.minLessonsPerDay}-${classItem.maxLessonsPerDay} გაკვეთილი დღეში</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>დღე</th>
                  ${Array.from({ length: classItem.maxLessonsPerDay }, (_, index) => `<th>${index + 1} გაკვეთილი</th>`).join("")}
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </article>
      `;
    })
    .join("");
}

function seedData() {
  $("shift2Enabled").checked = true;
  $("shift3Enabled").checked = false;
  updateShiftAvailability();

  state.classes = [
    {
      name: "1ა",
      grade: "1",
      section: "ა",
      shift: "1",
      minLessonsPerDay: 4,
      maxLessonsPerDay: 6,
      subjects: [
        { name: "ქართული", weeklyLessons: 7 },
        { name: "მათემატიკა", weeklyLessons: 7 },
        { name: "ინგლისური", weeklyLessons: 6 },
      ],
    },
    {
      name: "1ბ",
      grade: "1",
      section: "ბ",
      shift: "1",
      minLessonsPerDay: 4,
      maxLessonsPerDay: 6,
      subjects: [
        { name: "ქართული", weeklyLessons: 7 },
        { name: "მათემატიკა", weeklyLessons: 7 },
        { name: "ინგლისური", weeklyLessons: 6 },
      ],
    },
    {
      name: "2ა",
      grade: "2",
      section: "ა",
      shift: "1",
      minLessonsPerDay: 4,
      maxLessonsPerDay: 6,
      subjects: [
        { name: "ქართული", weeklyLessons: 6 },
        { name: "მათემატიკა", weeklyLessons: 6 },
        { name: "ინგლისური", weeklyLessons: 4 },
        { name: "ბუნება", weeklyLessons: 4 },
      ],
    },
    {
      name: "2ბ",
      grade: "2",
      section: "ბ",
      shift: "1",
      minLessonsPerDay: 4,
      maxLessonsPerDay: 6,
      subjects: [
        { name: "ქართული", weeklyLessons: 6 },
        { name: "მათემატიკა", weeklyLessons: 6 },
        { name: "ინგლისური", weeklyLessons: 4 },
        { name: "ბუნება", weeklyLessons: 4 },
      ],
    },
    {
      name: "3ა",
      grade: "3",
      section: "ა",
      shift: "2",
      minLessonsPerDay: 4,
      maxLessonsPerDay: 6,
      subjects: [
        { name: "ქართული", weeklyLessons: 5 },
        { name: "მათემატიკა", weeklyLessons: 5 },
        { name: "ინგლისური", weeklyLessons: 4 },
        { name: "ბუნება", weeklyLessons: 3 },
        { name: "ისტორია", weeklyLessons: 3 },
      ],
    },
    {
      name: "3ბ",
      grade: "3",
      section: "ბ",
      shift: "2",
      minLessonsPerDay: 4,
      maxLessonsPerDay: 6,
      subjects: [
        { name: "ქართული", weeklyLessons: 5 },
        { name: "მათემატიკა", weeklyLessons: 5 },
        { name: "ინგლისური", weeklyLessons: 4 },
        { name: "ბუნება", weeklyLessons: 3 },
        { name: "ისტორია", weeklyLessons: 3 },
      ],
    },
  ];
  state.teachers = [
    { name: "ნინო გიორგაძე", assignments: [{ name: "ქართული", classes: ["1ა"] }, { name: "მათემატიკა", classes: ["1ა"] }, { name: "ინგლისური", classes: ["1ა"] }], availability: DAYS.map((day) => ({ day, from: "09:00", to: "13:30" })) },
    { name: "თამარ ლომიძე", assignments: [{ name: "ქართული", classes: ["1ბ"] }, { name: "მათემატიკა", classes: ["1ბ"] }, { name: "ინგლისური", classes: ["1ბ"] }], availability: DAYS.map((day) => ({ day, from: "09:00", to: "13:30" })) },
    { name: "ლაშა კობახიძე", assignments: [{ name: "ქართული", classes: ["2ა"] }, { name: "მათემატიკა", classes: ["2ა"] }, { name: "ინგლისური", classes: ["2ა"] }, { name: "ბუნება", classes: ["2ა"] }], availability: DAYS.map((day) => ({ day, from: "09:00", to: "13:30" })) },
    { name: "ეკა ბერიძე", assignments: [{ name: "ქართული", classes: ["2ბ"] }, { name: "მათემატიკა", classes: ["2ბ"] }, { name: "ინგლისური", classes: ["2ბ"] }, { name: "ბუნება", classes: ["2ბ"] }], availability: DAYS.map((day) => ({ day, from: "09:00", to: "13:30" })) },
    { name: "მარიამ ჩიქოვანი", assignments: [{ name: "ქართული", classes: ["3ა"] }, { name: "მათემატიკა", classes: ["3ა"] }, { name: "ინგლისური", classes: ["3ა"] }, { name: "ბუნება", classes: ["3ა"] }, { name: "ისტორია", classes: ["3ა"] }], availability: DAYS.map((day) => ({ day, from: "14:00", to: "18:30" })) },
    { name: "გიორგი მაისურაძე", assignments: [{ name: "ქართული", classes: ["3ბ"] }, { name: "მათემატიკა", classes: ["3ბ"] }, { name: "ინგლისური", classes: ["3ბ"] }, { name: "ბუნება", classes: ["3ბ"] }, { name: "ისტორია", classes: ["3ბ"] }], availability: DAYS.map((day) => ({ day, from: "14:00", to: "18:30" })) },
    { name: "ანა ქავთარაძე", assignments: [{ name: "ინგლისური", classes: ["1ა", "1ბ", "2ა", "2ბ"] }, { name: "ქართული", classes: ["3ა", "3ბ"] }], availability: [...DAYS.map((day) => ({ day, from: "09:00", to: "12:30" })), ...DAYS.map((day) => ({ day, from: "15:00", to: "18:30" }))] },
    { name: "სოფიო აბაშიძე", assignments: [{ name: "ისტორია", classes: ["3ა", "3ბ"] }], availability: ["ორშაბათი", "ოთხშაბათი", "პარასკევი"].map((day) => ({ day, from: "14:00", to: "18:30" })) },
  ];
  setClassEditingMode(null);
  setTeacherEditingMode(null);
  renderClasses();
  renderTeachers();
  showMessages([{ type: "ok", text: "სატესტო მონაცემები ჩაიტვირთა." }]);
  persistDraft();
}

document.querySelectorAll(".step-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".step-button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.panel).classList.add("active");
    persistDraft();
  });
});

$("addClassBtn").addEventListener("click", addClass);
$("addTeacherBtn").addEventListener("click", addTeacher);
$("cancelClassEditBtn").addEventListener("click", resetClassForm);
$("cancelTeacherEditBtn").addEventListener("click", resetTeacherForm);
$("generateBtn").addEventListener("click", generateSchedule);
$("seedBtn").addEventListener("click", seedData);
$("clearAllBtn").addEventListener("click", clearAllData);
$("addSubjectBtn").addEventListener("click", () => addSubject($("subjectDraft").value));
$("copySubjectsBtn").addEventListener("click", copySubjectsFromClass);
$("clearSubjectsBtn").addEventListener("click", clearSelectedSubjects);
$("selectAllBulkClassesBtn").addEventListener("click", toggleAllBulkClasses);
$("addBulkSubjectBtn").addEventListener("click", addSubjectToSelectedClasses);
$("addTeacherSubjectBtn").addEventListener("click", () => addTeacherSubject($("teacherSubjectDraft").value));
$("addTeacherAvailabilityBtn").addEventListener("click", addTeacherAvailability);
$("classMinLessons").addEventListener("input", () => {
  updateLessonRangePreview();
  persistDraft();
});
$("classMaxLessons").addEventListener("input", () => {
  updateLessonRangePreview();
  persistDraft();
});
$("classSection").addEventListener("input", () => {
  renderSectionShiftOptions();
  persistDraft();
});
$("classGrade").addEventListener("input", renderSectionShiftOptions);
$("classShift").addEventListener("change", renderSectionShiftOptions);
$("subjectDraft").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addSubject($("subjectDraft").value);
});

$("teacherSubjectDraft").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addTeacherSubject($("teacherSubjectDraft").value);
});

document.querySelectorAll("[data-subject-preset]").forEach((button) => {
  button.addEventListener("click", () => addSubject(button.dataset.subjectPreset));
});

document.querySelectorAll("[data-teacher-subject-preset]").forEach((button) => {
  button.addEventListener("click", () => addTeacherSubject(button.dataset.teacherSubjectPreset));
});

document.querySelectorAll("[data-shift-toggle]").forEach((input) => {
  input.addEventListener("change", () => {
    updateShiftAvailability();
    persistDraft();
  });
});

document.querySelectorAll('input[name="breakMode"]').forEach((input) => {
  input.addEventListener("change", () => {
    updateBreakMode();
    persistDraft();
  });
});

document.querySelector(".content").addEventListener("input", persistDraft);
document.querySelector(".content").addEventListener("change", persistDraft);

$("subjectChips").addEventListener("click", (event) => {
  const index = event.target.dataset.removeSubject;
  if (index === undefined) return;
  state.selectedSubjects.splice(Number(index), 1);
  renderSubjectChips();
  persistDraft();
});

$("subjectChips").addEventListener("input", (event) => {
  const index = event.target.dataset.subjectCount;
  if (index === undefined) return;
  state.selectedSubjects[Number(index)].weeklyLessons = Number(event.target.value);
  persistDraft();
});

$("teacherSubjectChips").addEventListener("click", (event) => {
  const index = event.target.dataset.removeTeacherSubject;
  if (index === undefined) return;
  state.selectedTeacherSubjects.splice(Number(index), 1);
  renderTeacherSubjectChips();
  persistDraft();
});

$("teacherSubjectChips").addEventListener("change", (event) => {
  const index = event.target.dataset.teacherSubjectIndex;
  if (index === undefined) return;

  const assignment = state.selectedTeacherSubjects[Number(index)];
  if (!assignment) return;

  if (event.target.checked) {
    if (!assignment.classes.includes(event.target.value)) assignment.classes.push(event.target.value);
  } else {
    assignment.classes = assignment.classes.filter((className) => className !== event.target.value);
  }
  persistDraft();
});

$("teacherAvailabilityList").addEventListener("click", (event) => {
  const index = event.target.dataset.removeAvailability;
  if (index === undefined) return;
  state.selectedTeacherAvailability.splice(Number(index), 1);
  renderTeacherAvailabilityList();
  persistDraft();
});

$("bulkClassOptions").addEventListener("change", (event) => {
  if (!event.target.matches("[data-bulk-class]")) return;

  if (event.target.checked) {
    if (!state.selectedBulkClasses.includes(event.target.value)) state.selectedBulkClasses.push(event.target.value);
  } else {
    state.selectedBulkClasses = state.selectedBulkClasses.filter((className) => className !== event.target.value);
  }
  renderBulkClassOptions();
  persistDraft();
});

$("sectionShiftOptions").addEventListener("change", (event) => {
  const section = event.target.dataset.sectionShift;
  if (section === undefined) return;
  state.classSectionShifts[section] = event.target.value;
  persistDraft();
});

$("classesTable").addEventListener("click", (event) => {
  const editIndex = event.target.dataset.editClass;
  if (editIndex !== undefined) {
    editClass(Number(editIndex));
    return;
  }

  const duplicateIndex = event.target.dataset.duplicateClass;
  if (duplicateIndex !== undefined) {
    duplicateClass(Number(duplicateIndex));
    return;
  }

  const removeIndex = event.target.dataset.removeClass;
  if (removeIndex === undefined) return;

  const index = Number(removeIndex);
  const removedClassName = state.classes[index].name;
  state.classes.splice(index, 1);
  state.teachers.forEach((teacher) => {
    teacher.assignments.forEach((assignment) => {
      assignment.classes = assignment.classes.filter((className) => className !== removedClassName);
    });
  });
  if (state.editingClassIndex === index) setClassEditingMode(null);
  if (state.editingClassIndex !== null && state.editingClassIndex > index) state.editingClassIndex -= 1;
  renderClasses();
  renderTeachers();
  persistDraft();
});

$("teachersTable").addEventListener("click", (event) => {
  const editIndex = event.target.dataset.editTeacher;
  if (editIndex !== undefined) {
    editTeacher(Number(editIndex));
    return;
  }

  const removeIndex = event.target.dataset.removeTeacher;
  if (removeIndex === undefined) return;

  const index = Number(removeIndex);
  state.teachers.splice(index, 1);
  if (state.editingTeacherIndex === index) setTeacherEditingMode(null);
  if (state.editingTeacherIndex !== null && state.editingTeacherIndex > index) state.editingTeacherIndex -= 1;
  renderTeachers();
  persistDraft();
});

$("variantPicker").addEventListener("click", (event) => {
  const variantIndex = event.target.dataset.variantIndex;
  if (variantIndex !== undefined) {
    showVariant(Number(variantIndex));
    return;
  }

  if (event.target.dataset.keepVariant === "true") {
    keepSelectedVariant();
  }
});

const restoredDraft = restoreSavedDraft();

renderClasses();
renderTeachers();
renderSubjectChips();
renderTeacherSubjectChips();
renderTeacherAvailabilityList();
updateLessonRangePreview();
updateShiftAvailability();
updateBreakMode();
setClassEditingMode(state.editingClassIndex);
setTeacherEditingMode(state.editingTeacherIndex);

if (state.generatedVariants.length > 0) {
  const variantIndex = Math.min(state.selectedVariantIndex, state.generatedVariants.length - 1);
  showVariant(variantIndex);
} else if (restoredDraft) {
  showMessages([{ type: "ok", text: "შენახული სამუშაო აღდგა." }]);
}

persistDraft();
