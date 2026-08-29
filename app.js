const DAYS = ["ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი"];
const STORAGE_KEY = "school-calendar-builder-draft-v1";

const state = {
  classes: [],
  teachers: [],
  selectedSubjects: [],
  selectedTeacherSubjects: [],
  selectedTeacherAvailability: [],
  classSectionShifts: {},
  generatedVariants: [],
  selectedVariantIndex: 0,
  canLoadMoreVariants: false,
  generatedConfigSignature: "",
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

function isLegacyClassExample(subjects) {
  const examples = [
    { name: "ქართული", weeklyLessons: 7 },
    { name: "მათემატიკა", weeklyLessons: 7 },
    { name: "ინგლისური", weeklyLessons: 6 },
  ];
  return (
    Array.isArray(subjects) &&
    subjects.length === examples.length &&
    examples.every(
      (example, index) =>
        subjects[index]?.name === example.name && subjects[index]?.weeklyLessons === example.weeklyLessons,
    )
  );
}

function isLegacyTeacherExample(subjects) {
  return (
    Array.isArray(subjects) &&
    subjects.length === 1 &&
    subjects[0]?.name === "ქართული" &&
    Array.isArray(subjects[0]?.classes) &&
    subjects[0].classes.length === 0
  );
}

function isLegacyAvailabilityExample(availability) {
  return (
    Array.isArray(availability) &&
    availability.length === DAYS.length &&
    DAYS.every((day) => availability.some((item) => item.day === day && item.from === "09:00" && item.to === "17:00"))
  );
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
    classSectionShifts: state.classSectionShifts,
    generatedVariants: state.generatedVariants,
    selectedVariantIndex: state.selectedVariantIndex,
    canLoadMoreVariants: state.canLoadMoreVariants,
    generatedConfigSignature: state.generatedConfigSignature,
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
    const legacyClassExample = isLegacyClassExample(payload.selectedSubjects);
    const legacyTeacherExample = isLegacyTeacherExample(payload.selectedTeacherSubjects);
    const legacyAvailabilityExample = isLegacyAvailabilityExample(payload.selectedTeacherAvailability);
    state.selectedSubjects = legacyClassExample
      ? []
      : Array.isArray(payload.selectedSubjects)
        ? payload.selectedSubjects
        : state.selectedSubjects;
    state.selectedTeacherSubjects = Array.isArray(payload.selectedTeacherSubjects)
      ? legacyTeacherExample
        ? []
        : payload.selectedTeacherSubjects
      : state.selectedTeacherSubjects;
    state.selectedTeacherAvailability = Array.isArray(payload.selectedTeacherAvailability)
      ? legacyAvailabilityExample
        ? []
        : payload.selectedTeacherAvailability
      : state.selectedTeacherAvailability;
    state.classSectionShifts = payload.classSectionShifts && typeof payload.classSectionShifts === "object" ? payload.classSectionShifts : {};
    state.teachers = state.teachers.map(migrateTeacherAvailability);
    state.generatedVariants = Array.isArray(payload.generatedVariants)
      ? payload.generatedVariants.filter((variant) => variant.unresolved?.length === 0 && variant.dailyShortages?.length === 0)
      : [];
    state.selectedVariantIndex = Number.isInteger(payload.selectedVariantIndex) ? payload.selectedVariantIndex : 0;
    state.canLoadMoreVariants = payload.canLoadMoreVariants === true;
    state.generatedConfigSignature = typeof payload.generatedConfigSignature === "string" ? payload.generatedConfigSignature : "";
    state.editingClassIndex = Number.isInteger(payload.editingClassIndex) ? payload.editingClassIndex : null;
    state.editingTeacherIndex = Number.isInteger(payload.editingTeacherIndex) ? payload.editingTeacherIndex : null;

    $("classGrade").value = form.classGrade ?? $("classGrade").value;
    $("classSection").value = form.classSection ?? $("classSection").value;
    $("classShift").value = form.classShift ?? $("classShift").value;
    $("classMinLessons").value = form.classMinLessons ?? $("classMinLessons").value;
    $("classMaxLessons").value = form.classMaxLessons ?? $("classMaxLessons").value;
    $("subjectDraft").value = form.subjectDraft ?? "";
    $("shift2Enabled").checked = form.shift2Enabled ?? $("shift2Enabled").checked;
    $("shift3Enabled").checked = form.shift3Enabled ?? $("shift3Enabled").checked;
    $("shift1Start").value = form.shift1Start ?? $("shift1Start").value;
    $("shift2Start").value = form.shift2Start ?? $("shift2Start").value;
    $("shift3Start").value = form.shift3Start ?? $("shift3Start").value;
    $("lessonDuration").value = form.lessonDuration ?? $("lessonDuration").value;
    $("breakDuration").value = form.breakDuration ?? $("breakDuration").value;
    $("customBreaks").value = form.customBreaks === "5, 10, 5, 10, 5" ? "" : (form.customBreaks ?? $("customBreaks").value);
    $("teacherName").value = form.teacherName === "ნინო მასწავლებელი" ? "" : (form.teacherName ?? $("teacherName").value);
    $("teacherSubjectDraft").value = form.teacherSubjectDraft ?? "";
    $("teacherAvailabilityDay").value = form.teacherAvailabilityDay ?? "ყველა";
    $("teacherAvailabilityFrom").value = legacyAvailabilityExample
      ? ""
      : (form.teacherAvailabilityFrom ?? form.teacherFrom ?? $("teacherAvailabilityFrom").value);
    $("teacherAvailabilityTo").value = legacyAvailabilityExample
      ? ""
      : (form.teacherAvailabilityTo ?? form.teacherTo ?? $("teacherAvailabilityTo").value);

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
  if (!normalized) {
    showMessages([{ type: "error", text: "ჯერ ჩაწერე საგნის სახელი და შემდეგ დააჭირე დამატებას." }]);
    $("subjectDraft").focus();
    return;
  }

  const exists = state.selectedSubjects.some((item) => item.name.toLowerCase() === normalized.toLowerCase());
  if (exists) {
    showMessages([{ type: "warning", text: `საგანი „${normalized}“ უკვე დამატებულია.` }]);
    return;
  }
  state.selectedSubjects.push({ name: normalized, weeklyLessons: 1 });

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

function addTeacherSubject(subject) {
  const normalized = subject.trim();
  if (!normalized) {
    showMessages([{ type: "error", text: "ჯერ ჩაწერე მასწავლებლის საგანი და შემდეგ დააჭირე დამატებას." }]);
    $("teacherSubjectDraft").focus();
    return;
  }

  const exists = state.selectedTeacherSubjects.some((item) => item.name.toLowerCase() === normalized.toLowerCase());
  if (exists) {
    showMessages([{ type: "warning", text: `საგანი „${normalized}“ ამ მასწავლებელთან უკვე დამატებულია.` }]);
    return;
  }
  state.selectedTeacherSubjects.push({ name: normalized, classes: [] });

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
  let addedCount = 0;
  days.forEach((day) => {
    const exists = state.selectedTeacherAvailability.some((item) => item.day === day && item.from === from && item.to === to);
    if (!exists) {
      state.selectedTeacherAvailability.push({ day, from, to });
      addedCount += 1;
    }
  });

  if (addedCount === 0) {
    showMessages([{ type: "warning", text: "ეს თავისუფალი დრო უკვე დამატებულია." }]);
    return;
  }

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
  state.selectedSubjects = [];
  setClassEditingMode(null);
  renderSubjectChips();
  updateLessonRangePreview();
  updateShiftAvailability();
  persistDraft();
}

function resetTeacherForm() {
  $("teacherName").value = "";
  state.selectedTeacherSubjects = [];
  state.selectedTeacherAvailability = [];
  $("teacherAvailabilityDay").value = "ყველა";
  $("teacherAvailabilityFrom").value = "";
  $("teacherAvailabilityTo").value = "";
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
  state.classSectionShifts = {};
  state.generatedVariants = [];
  state.selectedVariantIndex = 0;
  state.canLoadMoreVariants = false;
  state.generatedConfigSignature = "";
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
  const formErrors = [];

  if (!Number.isInteger(Number(grade)) || Number(grade) < 1 || Number(grade) > 12) {
    formErrors.push("კლასი უნდა იყოს მთელი რიცხვი 1-დან 12-მდე.");
  }
  if (sections.some((section) => section.length > 2 || /\s/.test(section))) {
    formErrors.push("ქვეკლასი ჩაწერე მოკლედ, მაგალითად ა. რამდენიმე ქვეკლასი გამოყავი მძიმით: ა, ბ, გ.");
  }
  if (subjects.length === 0) formErrors.push("დაამატე მინიმუმ ერთი საგანი.");
  subjects.forEach((subject) => {
    if (!subject.name.trim()) formErrors.push("საგნის სახელი ცარიელი ვერ იქნება.");
    if (!Number.isInteger(subject.weeklyLessons) || subject.weeklyLessons < 1 || subject.weeklyLessons > 20) {
      formErrors.push(`საგანს „${subject.name}“ კვირეული რაოდენობა 1-დან 20-მდე უნდა ჰქონდეს.`);
    }
  });
  if (state.editingClassIndex !== null && sections.length > 1) {
    formErrors.push("ერთი კლასის რედაქტირებისას მხოლოდ ერთი ქვეკლასი მიუთითე.");
  }
  if (!Number.isInteger(minLessonsPerDay) || minLessonsPerDay < 1 || minLessonsPerDay > 10) {
    formErrors.push("დღიური მინიმუმი უნდა იყოს 1-დან 10-მდე.");
  }
  if (!Number.isInteger(maxLessonsPerDay) || maxLessonsPerDay < 1 || maxLessonsPerDay > 10) {
    formErrors.push("დღიური მაქსიმუმი უნდა იყოს 1-დან 10-მდე.");
  }
  if (Number.isInteger(minLessonsPerDay) && Number.isInteger(maxLessonsPerDay) && minLessonsPerDay > maxLessonsPerDay) {
    formErrors.push("დღიური მინიმუმი მაქსიმუმზე მეტი ვერ იქნება.");
  }
  if (!getActiveShifts().includes($("classShift").value)) {
    formErrors.push("არჩეული სმენა გამორთულია. აირჩიე მოქმედი სმენა.");
  }

  if (formErrors.length > 0) {
    showValidationError("კლასი ვერ დაემატა", formErrors, !grade ? "classGrade" : null);
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
  const formErrors = [];

  if (!name) formErrors.push("ჩაწერე მასწავლებლის სახელი და გვარი.");
  if (assignments.length === 0) formErrors.push("დაამატე მინიმუმ ერთი საგანი.");
  assignments.forEach((assignment) => {
    if (!assignment.name.trim()) formErrors.push("საგნის სახელი ცარიელი ვერ იქნება.");
    if (assignment.classes.length === 0) {
      formErrors.push(`საგანთან „${assignment.name}“ მონიშნე მინიმუმ ერთი კლასი.`);
    }
    assignment.classes.forEach((classNameValue) => {
      const classItem = state.classes.find((item) => item.name === classNameValue);
      if (classItem && !classItem.subjects.some((subject) => subject.name.toLowerCase() === assignment.name.toLowerCase())) {
        formErrors.push(`${classNameValue} კლასი არ სწავლობს საგანს „${assignment.name}“. შეცვალე კლასი ან საგანი.`);
      }
    });
  });
  if (classes.length === 0 && assignments.length > 0) formErrors.push("მონიშნე, რომელ კლასებს ასწავლის მასწავლებელი.");
  if (availability.length === 0) formErrors.push("დაამატე მინიმუმ ერთი თავისუფალი დღე და დრო.");
  if (availability.some((item) => !DAYS.includes(item.day) || !isValidTime(item.from) || !isValidTime(item.to))) {
    formErrors.push("ერთ-ერთი თავისუფალი დრო არასწორია. გამოიყენე 24-საათიანი ფორმატი, მაგალითად 09:00.");
  }
  if (
    availability.some(
      (item) => isValidTime(item.from) && isValidTime(item.to) && timeToMinutes(item.from) >= timeToMinutes(item.to),
    )
  ) {
    formErrors.push("თავისუფალი დროის დასაწყისი დასრულებაზე ადრე უნდა იყოს.");
  }
  if (state.teachers.some((teacher, index) => teacher.name.toLowerCase() === name.toLowerCase() && index !== state.editingTeacherIndex)) {
    formErrors.push(`მასწავლებელი „${name}“ უკვე დამატებულია.`);
  }

  if (formErrors.length > 0) {
    showValidationError("მასწავლებელი ვერ დაემატა", formErrors, !name ? "teacherName" : null);
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
  showMessages([{ type: "warning", text: `${item.name} ჩაიტვირთა შესაცვლელად. დასრულებისას დააჭირე „ცვლილების შენახვა“.` }]);
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
  showMessages([{ type: "warning", text: `${item.name} ჩაიტვირთა შესაცვლელად. დასრულებისას დააჭირე „ცვლილების შენახვა“.` }]);
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

function solverWorkerMain() {
  const DAYS = ["ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი"];

  self.onmessage = (event) => {
    try {
      self.postMessage(solvePartition(event.data));
    } catch (error) {
      self.postMessage({ error: error?.message || "უცნობი შეცდომა" });
    }
  };

  function timeToMinutes(value) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function minutesToTime(value) {
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function breakAfter(settings, lesson) {
    if (settings.breakMode === "constant") return settings.breakDuration;
    return Number.isFinite(settings.customBreaks[lesson - 1]) ? settings.customBreaks[lesson - 1] : 0;
  }

  function buildClassSlots(classItem, settings) {
    const slots = [];
    let start = timeToMinutes(settings.shiftStarts[classItem.shift]);
    for (let lesson = 1; lesson <= classItem.maxLessonsPerDay; lesson += 1) {
      const end = start + settings.lessonDuration;
      slots.push({ lesson, start, end, label: `${minutesToTime(start)}-${minutesToTime(end)}` });
      start = end + breakAfter(settings, lesson);
    }
    return slots;
  }

  function solvePartition(input) {
    const startedAt = Date.now();
    const deadline = startedAt + input.timeLimitMs;
    const solutions = [];
    const signatures = new Set();
    const excludedSignatures = new Set(input.excludedSignatures || []);
    const teacherBusy = input.teachers.map(() => DAYS.map(() => []));
    const currentSchedule = Object.fromEntries(
      input.classes.map((classItem) => [
        classItem.name,
        { classItem, days: Object.fromEntries(DAYS.map((day) => [day, []])) },
      ]),
    );
    let nodes = 0;
    let timedOut = false;
    let solutionLimitReached = false;
    let firstClassLayoutIndex = 0;

    function shouldStop() {
      nodes += 1;
      if (solutions.length >= input.maxSolutions) {
        solutionLimitReached = true;
        return true;
      }
      if (Date.now() >= deadline) {
        timedOut = true;
        return true;
      }
      return false;
    }

    function teacherMatches(teacher, classItem, subjectName) {
      return (teacher.assignments || []).some(
        (assignment) =>
          assignment.name.toLowerCase() === subjectName.toLowerCase() &&
          (assignment.classes || []).includes(classItem.name),
      );
    }

    function teacherAvailable(teacher, day, slot) {
      return (teacher.availability || []).some(
        (range) =>
          range.day === day &&
          timeToMinutes(range.from) <= slot.start &&
          timeToMinutes(range.to) >= slot.end,
      );
    }

    function hasConflict(teacherIndex, dayIndex, slot) {
      return teacherBusy[teacherIndex][dayIndex].some(
        (busySlot) => slot.start < busySlot.end && slot.end > busySlot.start,
      );
    }

    function buildContext(classItem) {
      const slots = buildClassSlots(classItem, input.settings);
      const candidateCache = new Map();

      function candidates(subjectName, dayIndex, lessonIndex) {
        const key = `${subjectName}|${dayIndex}|${lessonIndex}`;
        if (!candidateCache.has(key)) {
          const slot = slots[lessonIndex];
          candidateCache.set(
            key,
            input.teachers
              .map((teacher, teacherIndex) => ({ teacher, teacherIndex }))
              .filter(
                ({ teacher }) =>
                  teacherMatches(teacher, classItem, subjectName) && teacherAvailable(teacher, DAYS[dayIndex], slot),
              )
              .map(({ teacherIndex }) => teacherIndex),
          );
        }
        return candidateCache.get(key);
      }

      const scarcity = classItem.subjects.reduce((score, subject) => {
        let possible = 0;
        for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex += 1) {
          for (let lessonIndex = 0; lessonIndex < slots.length; lessonIndex += 1) {
            if (candidates(subject.name, dayIndex, lessonIndex).length > 0) possible += 1;
          }
        }
        return score + subject.weeklyLessons / Math.max(1, possible);
      }, 0);

      return { classItem, slots, candidates, scarcity };
    }

    const contexts = input.classes
      .map(buildContext)
      .sort(
        (first, second) =>
          second.scarcity - first.scarcity ||
          second.classItem.subjects.length - first.classItem.subjects.length ||
          first.classItem.name.localeCompare(second.classItem.name, "ka"),
      );

    function snapshotSchedule() {
      return Object.fromEntries(
        input.classes.map((classItem) => {
          const current = currentSchedule[classItem.name];
          return [
            classItem.name,
            {
              classItem,
              days: Object.fromEntries(
                DAYS.map((day) => [day, current.days[day].map((lesson) => ({ ...lesson }))]),
              ),
            },
          ];
        }),
      );
    }

    function scheduleSignature(schedule) {
      return input.classes
        .map((classItem) =>
          DAYS.flatMap((day) =>
            schedule[classItem.name].days[day].map(
              (lesson) => `${classItem.name}:${day}:${lesson.lesson}:${lesson.subject}:${lesson.teacher}`,
            ),
          ).join("|"),
        )
        .join("||");
    }

    function enumerateDailyCounts(classItem, callback) {
      const totalLessons = classItem.subjects.reduce((total, subject) => total + subject.weeklyLessons, 0);
      const counts = Array(DAYS.length).fill(0);

      function visit(dayIndex, remaining) {
        if (shouldStop()) return true;
        if (dayIndex === DAYS.length) return remaining === 0 ? callback([...counts]) : false;

        const daysAfter = DAYS.length - dayIndex - 1;
        const lower = Math.max(classItem.minLessonsPerDay, remaining - daysAfter * classItem.maxLessonsPerDay);
        const upper = Math.min(classItem.maxLessonsPerDay, remaining - daysAfter * classItem.minLessonsPerDay);
        if (lower > upper) return false;

        const target = remaining / (daysAfter + 1);
        const values = Array.from({ length: upper - lower + 1 }, (_, index) => lower + index).sort(
          (first, second) => Math.abs(first - target) - Math.abs(second - target) || first - second,
        );
        for (const value of values) {
          counts[dayIndex] = value;
          if (visit(dayIndex + 1, remaining - value)) return true;
        }
        return false;
      }

      return visit(0, totalLessons);
    }

    function enumerateLayouts(context, counts, callback) {
      const positions = [];
      counts.forEach((count, dayIndex) => {
        for (let lessonIndex = 0; lessonIndex < count; lessonIndex += 1) {
          positions.push({ dayIndex, lessonIndex, slot: context.slots[lessonIndex] });
        }
      });

      const remaining = context.classItem.subjects.map((subject) => subject.weeklyLessons);
      const usedSubjectsByDay = DAYS.map(() => new Set());
      const lessons = Array(positions.length);

      function enoughFutureSpace(nextIndex) {
        for (let subjectIndex = 0; subjectIndex < remaining.length; subjectIndex += 1) {
          if (remaining[subjectIndex] <= 0) continue;
          const subject = context.classItem.subjects[subjectIndex];
          if (subject.weeklyLessons > DAYS.length) continue;

          const possibleDays = new Set();
          for (let positionIndex = nextIndex; positionIndex < positions.length; positionIndex += 1) {
            const dayIndex = positions[positionIndex].dayIndex;
            if (!usedSubjectsByDay[dayIndex].has(subject.name)) possibleDays.add(dayIndex);
          }
          if (remaining[subjectIndex] > possibleDays.size) return false;
        }
        return true;
      }

      function visit(positionIndex) {
        if (shouldStop()) return true;
        if (positionIndex === positions.length) return callback(lessons.map((lesson) => ({ ...lesson })));

        const position = positions[positionIndex];
        const candidates = context.classItem.subjects
          .map((subject, subjectIndex) => ({ subject, subjectIndex }))
          .filter(({ subject, subjectIndex }) => {
            if (remaining[subjectIndex] <= 0) return false;
            if (subject.weeklyLessons <= DAYS.length && usedSubjectsByDay[position.dayIndex].has(subject.name)) return false;
            return context.candidates(subject.name, position.dayIndex, position.lessonIndex).length > 0;
          })
          .sort(
            (first, second) =>
              context.candidates(first.subject.name, position.dayIndex, position.lessonIndex).length -
                context.candidates(second.subject.name, position.dayIndex, position.lessonIndex).length ||
              remaining[second.subjectIndex] - remaining[first.subjectIndex] ||
              first.subject.name.localeCompare(second.subject.name, "ka"),
          );

        for (const candidate of candidates) {
          remaining[candidate.subjectIndex] -= 1;
          usedSubjectsByDay[position.dayIndex].add(candidate.subject.name);
          lessons[positionIndex] = {
            ...position,
            subject: candidate.subject.name,
            baseCandidates: context.candidates(candidate.subject.name, position.dayIndex, position.lessonIndex),
          };

          if (enoughFutureSpace(positionIndex + 1) && visit(positionIndex + 1)) return true;

          remaining[candidate.subjectIndex] += 1;
          if (candidate.subject.weeklyLessons <= DAYS.length) {
            usedSubjectsByDay[position.dayIndex].delete(candidate.subject.name);
          }
        }
        return false;
      }

      return visit(0);
    }

    function assignTeachers(context, lessons, onComplete) {
      const assignments = Array(lessons.length).fill(-1);

      function visit(assignedCount) {
        if (shouldStop()) return true;
        if (assignedCount === lessons.length) return onComplete(assignments);

        let selectedLessonIndex = -1;
        let selectedCandidates = null;
        for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
          if (assignments[lessonIndex] !== -1) continue;
          const lesson = lessons[lessonIndex];
          const available = lesson.baseCandidates.filter(
            (teacherIndex) => !hasConflict(teacherIndex, lesson.dayIndex, lesson.slot),
          );
          if (available.length === 0) return false;
          if (!selectedCandidates || available.length < selectedCandidates.length) {
            selectedLessonIndex = lessonIndex;
            selectedCandidates = available;
            if (available.length === 1) break;
          }
        }

        const lesson = lessons[selectedLessonIndex];
        const orderedCandidates = [...selectedCandidates].sort(
          (first, second) =>
            ((first + input.partitionIndex) % input.teachers.length) -
            ((second + input.partitionIndex) % input.teachers.length),
        );
        for (const teacherIndex of orderedCandidates) {
          assignments[selectedLessonIndex] = teacherIndex;
          teacherBusy[teacherIndex][lesson.dayIndex].push({ start: lesson.slot.start, end: lesson.slot.end });
          if (visit(assignedCount + 1)) return true;
          teacherBusy[teacherIndex][lesson.dayIndex].pop();
          assignments[selectedLessonIndex] = -1;
        }
        return false;
      }

      return visit(0);
    }

    function searchClass(contextIndex) {
      if (shouldStop()) return true;
      if (contextIndex === contexts.length) {
        const schedule = snapshotSchedule();
        const signature = scheduleSignature(schedule);
        if (!signatures.has(signature)) {
          signatures.add(signature);
          if (!excludedSignatures.has(signature)) {
            solutions.push({ schedule, unresolved: [], dailyShortages: [] });
          }
        }
        if (solutions.length >= input.maxSolutions) {
          solutionLimitReached = true;
          return true;
        }
        return false;
      }

      const context = contexts[contextIndex];
      return enumerateDailyCounts(context.classItem, (counts) =>
        enumerateLayouts(context, counts, (lessons) => {
          if (contextIndex === 0) {
            const layoutIndex = firstClassLayoutIndex;
            firstClassLayoutIndex += 1;
            if (layoutIndex % input.partitionCount !== input.partitionIndex) return false;
          }

          return assignTeachers(context, lessons, (assignments) => {
            const days = Object.fromEntries(DAYS.map((day) => [day, []]));
            lessons.forEach((lesson, lessonIndex) => {
              days[DAYS[lesson.dayIndex]].push({
                lesson: lesson.slot.lesson,
                time: lesson.slot.label,
                subject: lesson.subject,
                teacher: input.teachers[assignments[lessonIndex]].name,
              });
            });
            currentSchedule[context.classItem.name].days = days;
            const stop = searchClass(contextIndex + 1);
            currentSchedule[context.classItem.name].days = Object.fromEntries(DAYS.map((day) => [day, []]));
            return stop;
          });
        }),
      );
    }

    searchClass(0);
    return {
      solutions,
      timedOut,
      exhaustive: !timedOut && !solutionLimitReached,
      nodes,
      elapsedMs: Date.now() - startedAt,
    };
  }
}

async function runConstraintSolver(settings, options = {}) {
  const maxVariants = options.maxVariants || 10;
  const excludedSignatures = options.excludedSignatures || [];
  const availableProcessors = Math.max(1, Number(navigator.hardwareConcurrency) || 2);
  const workerCount = Math.min(6, availableProcessors);
  const workerSource = `(${solverWorkerMain.toString()})()`;
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const workers = [];

  try {
    const tasks = Array.from({ length: workerCount }, (_, partitionIndex) =>
      new Promise((resolve) => {
        const worker = new Worker(workerUrl);
        workers.push(worker);
        worker.onmessage = (event) => resolve(event.data);
        worker.onerror = () => resolve({ error: "ძებნის პროცესი ვერ გაეშვა." });
        worker.postMessage({
          classes: state.classes,
          teachers: state.teachers.map(migrateTeacherAvailability),
          settings,
          partitionIndex,
          partitionCount: workerCount,
          maxSolutions: maxVariants,
          excludedSignatures,
          timeLimitMs: 30000,
        });
      }),
    );
    const results = await Promise.all(tasks);
    if (results.some((result) => result.error)) throw new Error(results.find((result) => result.error).error);

    const variants = [];
    const seen = new Set(excludedSignatures);
    results.forEach((result) => {
      result.solutions.forEach((solution) => {
        const signature = scheduleSignature(solution.schedule);
        if (seen.has(signature)) return;
        seen.add(signature);
        variants.push(solution);
      });
    });

    return {
      variants: variants.slice(0, maxVariants),
      hasMore: variants.length > maxVariants || results.some((result) => !result.exhaustive),
      timedOut: results.some((result) => result.timedOut),
      exhaustive: results.every((result) => result.exhaustive),
      nodes: results.reduce((total, result) => total + result.nodes, 0),
      elapsedMs: Math.max(...results.map((result) => result.elapsedMs)),
      workerCount,
    };
  } finally {
    workers.forEach((worker) => worker.terminate());
    URL.revokeObjectURL(workerUrl);
  }
}

async function generateSchedule() {
  const settings = getSettings();
  const errors = validateBeforeGenerate(settings);

  if (errors.length > 0) {
    showMessages([
      {
        type: "error",
        title: "ცხრილის შექმნამდე რამდენიმე რამეა შესასწორებელი",
        text: "გაიარე ქვემოთ ჩამოთვლილი პუნქტები და შემდეგ კვლავ დააჭირე გენერაციას.",
        details: errors,
      },
    ]);
    state.generatedVariants = [];
    state.selectedVariantIndex = 0;
    state.canLoadMoreVariants = false;
    state.generatedConfigSignature = "";
    $("scheduleOutput").innerHTML = "";
    $("variantPicker").classList.add("hidden");
    $("variantPicker").innerHTML = "";
    persistDraft();
    return;
  }

  const generateButton = $("generateBtn");
  const originalButtonText = generateButton.textContent;
  generateButton.disabled = true;
  generateButton.textContent = "მიმდინარეობს ძებნა...";
  showMessages([
    {
      type: "info",
      title: "მიმდინარეობს სრული ძებნა",
      text: "პროგრამა რამდენიმე პროცესით ამოწმებს საგნების, დღეების, საათებისა და მასწავლებლების კომბინაციებს. რთულ მონაცემებს შეიძლება დაახლოებით 30 წამი დასჭირდეს.",
    },
  ]);
  $("scheduleOutput").innerHTML = "";
  $("variantPicker").classList.add("hidden");
  await new Promise((resolve) => setTimeout(resolve, 60));

  try {
    const result = await runConstraintSolver(settings);
    state.generatedVariants = result.variants;
    state.selectedVariantIndex = 0;
    state.canLoadMoreVariants = result.hasMore;
    state.generatedConfigSignature = configurationSignature(settings);

    if (result.variants.length === 0) {
      showMessages([
        result.timedOut
          ? {
              type: "warning",
              title: "30-წამიანი ღრმა ძებნა დასრულდა, მაგრამ პასუხი ჯერ არ დადასტურდა",
              text: "ეს არ ნიშნავს, რომ ცხრილი შეუძლებელია. კონფიგურაცია ძალიან რთულია; შეამცირე შეზღუდვები ან კვლავ გაუშვი ძებნა სხვა კომბინაციების შესამოწმებლად.",
              details: [`შემოწმდა ${result.nodes.toLocaleString("ka-GE")} შესაძლო ნაბიჯი ${result.workerCount} პარალელურ პროცესში.`],
            }
          : {
              type: "error",
              title: "გამართული ცხრილი ვერ არსებობს",
              text: "ყველა შესაძლო კომბინაცია ამოიწურა და ვერც ერთმა დაიცვა ყველა მითითებული წესი.",
              details: [
                "შეამცირე კლასის დღიური მინიმუმი, გაზარდე მაქსიმუმი ან გააფართოვე მასწავლებლების თავისუფალი დრო.",
                `სრულად შემოწმდა ${result.nodes.toLocaleString("ka-GE")} შესაძლო ნაბიჯი.`,
              ],
            },
      ]);
      renderVariantPicker();
      persistDraft();
      return;
    }

    renderVariantPicker();
    showVariant(0);
    persistDraft();
  } catch (error) {
    state.generatedVariants = [];
    state.canLoadMoreVariants = false;
    state.generatedConfigSignature = "";
    showMessages([
      {
        type: "error",
        title: "ცხრილის ძებნა ტექნიკური მიზეზით შეწყდა",
        text: error?.message || "ძებნის პროცესის გაშვება ვერ მოხერხდა. განაახლე გვერდი და სცადე ხელახლა.",
      },
    ]);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = originalButtonText;
  }
}

async function loadMoreVariants() {
  const settings = getSettings();
  if (configurationSignature(settings) !== state.generatedConfigSignature) {
    showMessages([
      {
        type: "warning",
        title: "მონაცემები შეიცვალა",
        text: "ახალი მონაცემებით ვარიანტების მოსაძებნად თავიდან დააჭირე „ცხრილის გენერაციას“.",
      },
    ]);
    return;
  }

  const button = document.querySelector('[data-load-more-variants="true"]');
  if (button) {
    button.disabled = true;
    button.textContent = "ახალი ვარიანტები იძებნება...";
  }
  showMessages([
    {
      type: "info",
      title: "ვეძებთ ახალ ვარიანტებს",
      text: "უკვე ნაჩვენები ცხრილები გამოტოვებულია. ძებნას შეიძლება დაახლოებით 30 წამი დასჭირდეს.",
    },
  ]);

  try {
    const excludedSignatures = state.generatedVariants.map((variant) => scheduleSignature(variant.schedule));
    const result = await runConstraintSolver(settings, { maxVariants: 10, excludedSignatures });
    const firstNewIndex = state.generatedVariants.length;
    state.generatedVariants.push(...result.variants);
    state.canLoadMoreVariants = result.hasMore;

    if (result.variants.length > 0) {
      showVariant(firstNewIndex);
    } else {
      renderVariantPicker();
      showMessages([
        {
          type: result.timedOut ? "warning" : "info",
          title: result.timedOut ? "ამ ძებნაში ახალი ვარიანტი ვერ მოიძებნა" : "ყველა შესაძლო ვარიანტი ნაჩვენებია",
          text: result.timedOut
            ? "შეგიძლია ძებნა კიდევ ერთხელ გააგრძელო, ან უკვე ნაჩვენები ვარიანტებიდან აირჩიო სასურველი."
            : "სხვა ვალიდური ცხრილი ამ მონაცემებით აღარ არსებობს.",
        },
      ]);
      persistDraft();
    }
  } catch (error) {
    showMessages([
      {
        type: "error",
        title: "ახალი ვარიანტების ძებნა შეწყდა",
        text: error?.message || "სცადე კიდევ ერთხელ.",
      },
    ]);
    renderVariantPicker();
  }
}

function showVariant(index) {
  const variant = state.generatedVariants[index];
  if (!variant) return;

  state.selectedVariantIndex = index;
  renderVariantPicker();
  showMessages([
    {
      type: "ok",
      text: `${state.generatedVariants.length} სრულად გამართული ვარიანტი მოიძებნა ყველა მითითებული წესის დაცვით. არჩეულია ვარიანტი ${index + 1}.`,
    },
  ]);

  renderSchedule(variant.schedule);
  persistDraft();
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

function configurationSignature(settings) {
  return JSON.stringify({
    classes: state.classes,
    teachers: state.teachers.map(migrateTeacherAvailability),
    settings,
  });
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
      ${state.canLoadMoreVariants ? '<button data-load-more-variants="true">კიდევ ვარიანტების ნახვა</button>' : ""}
      <button class="primary" data-keep-variant="true">ამ ვარიანტის დატოვება</button>
    </div>
  `;
}

function keepSelectedVariant() {
  const variant = state.generatedVariants[state.selectedVariantIndex];
  if (!variant) return;

  state.generatedVariants = [variant];
  state.selectedVariantIndex = 0;
  state.canLoadMoreVariants = false;
  renderVariantPicker();
  renderSchedule(variant.schedule);
  showMessages([{ type: "ok", text: "არჩეული ვარიანტი დატოვებულია." }]);
  persistDraft();
}

function validateBeforeGenerate(settings) {
  const errors = [];
  const shiftNames = { 1: "პირველი", 2: "მეორე", 3: "მესამე" };

  if (state.classes.length === 0) errors.push("ნაბიჯი 1 — დაამატე მინიმუმ ერთი კლასი.");
  if (state.teachers.length === 0) errors.push("ნაბიჯი 3 — დაამატე მინიმუმ ერთი მასწავლებელი.");

  settings.activeShifts.forEach((shift) => {
    if (!isValidTime(settings.shiftStarts[shift])) {
      errors.push(`ნაბიჯი 2 — ${shiftNames[shift]} სმენის დაწყების დრო ჩაწერე ფორმატით საათი:წუთი, მაგალითად 09:00.`);
    }
  });

  if (!Number.isFinite(settings.lessonDuration) || settings.lessonDuration < 20 || settings.lessonDuration > 90) {
    errors.push("ნაბიჯი 2 — გაკვეთილის ხანგრძლივობა უნდა იყოს 20-დან 90 წუთამდე.");
  }
  if (!Number.isFinite(settings.breakDuration) || settings.breakDuration < 0 || settings.breakDuration > 40) {
    errors.push("ნაბიჯი 2 — მუდმივი დასვენება უნდა იყოს 0-დან 40 წუთამდე.");
  }
  if (settings.breakMode === "custom") {
    if (settings.customBreaks.length === 0) {
      errors.push("ნაბიჯი 2 — განსხვავებული დასვენებების ველში ჩაწერე წუთები, მაგალითად 5, 10, 5.");
    }
    if (settings.customBreaks.some((duration) => !Number.isFinite(duration) || duration < 0 || duration > 120)) {
      errors.push("ნაბიჯი 2 — თითოეული განსხვავებული დასვენება უნდა იყოს 0-დან 120 წუთამდე და გამოყოფილი მძიმით.");
    }
    const requiredBreakCount = Math.max(0, ...state.classes.map((classItem) => classItem.maxLessonsPerDay - 1));
    if (settings.customBreaks.length > 0 && settings.customBreaks.length < requiredBreakCount) {
      errors.push(
        `ნაბიჯი 2 — მაქსიმუმ ${requiredBreakCount + 1} გაკვეთილისთვის ჩაწერე მინიმუმ ${requiredBreakCount} დასვენების დრო.`,
      );
    }
  }

  const teacherNames = new Set();
  for (const teacher of state.teachers) {
    const teacherName = teacher.name?.trim() || "უსახელო მასწავლებელი";
    const normalizedTeacherName = teacherName.toLowerCase();
    if (!teacher.name?.trim()) errors.push("ნაბიჯი 3 — ერთ-ერთ მასწავლებელს სახელი და გვარი არ აქვს მითითებული.");
    if (teacherNames.has(normalizedTeacherName)) {
      errors.push(`ნაბიჯი 3 — მასწავლებელი „${teacherName}“ ორჯერ არის დამატებული. დატოვე მხოლოდ ერთი ჩანაწერი.`);
    }
    teacherNames.add(normalizedTeacherName);

    if (!Array.isArray(teacher.assignments) || teacher.assignments.length === 0) {
      errors.push(`ნაბიჯი 3 — ${teacherName} მასწავლებელს არც ერთი საგანი არ აქვს დამატებული.`);
    }

    (teacher.assignments || []).forEach((assignment) => {
      if (!assignment.name?.trim()) errors.push(`ნაბიჯი 3 — ${teacherName} მასწავლებელს დამატებული აქვს უსახელო საგანი.`);
      if (!Array.isArray(assignment.classes) || assignment.classes.length === 0) {
        errors.push(`ნაბიჯი 3 — ${teacherName} მასწავლებლის საგანთან „${assignment.name}“ არც ერთი კლასი არ არის მონიშნული.`);
      }
      (assignment.classes || []).forEach((classNameValue) => {
        const classItem = state.classes.find((item) => item.name === classNameValue);
        if (!classItem) {
          errors.push(`ნაბიჯი 3 — ${teacherName} მასწავლებელთან მითითებული კლასი „${classNameValue}“ აღარ არსებობს.`);
        } else if (!classItem.subjects.some((subject) => subject.name.toLowerCase() === assignment.name.toLowerCase())) {
          errors.push(
            `ნაბიჯი 3 — ${teacherName} მონიშნულია საგანზე „${assignment.name}“ ${classNameValue} კლასში, მაგრამ ამ კლასს ეს საგანი არ აქვს.`,
          );
        }
      });
    });

    const availability = migrateTeacherAvailability(teacher).availability;
    if (availability.length === 0) {
      errors.push(`ნაბიჯი 3 — ${teacherName} მასწავლებელს თავისუფალი დრო არ აქვს მითითებული.`);
    }
    if (availability.some((item) => !DAYS.includes(item.day) || !isValidTime(item.from) || !isValidTime(item.to))) {
      errors.push(`ნაბიჯი 3 — ${teacherName} მასწავლებლის ერთ-ერთი თავისუფალი დრო არასწორია. გამოიყენე ფორმატი 09:00.`);
    }
    if (
      availability.some(
        (item) => isValidTime(item.from) && isValidTime(item.to) && timeToMinutes(item.from) >= timeToMinutes(item.to),
      )
    ) {
      errors.push(`ნაბიჯი 3 — ${teacherName} მასწავლებლის თავისუფალი დროის დასაწყისი დასრულებაზე ადრე უნდა იყოს.`);
    }
  }

  const classNames = new Set();
  for (const classItem of state.classes) {
    const weeklyLessonTotal = (classItem.subjects || []).reduce((total, subject) => total + subject.weeklyLessons, 0);
    const normalizedClassName = classItem.name.toLowerCase();

    if (classNames.has(normalizedClassName)) {
      errors.push(`ნაბიჯი 1 — კლასი „${classItem.name}“ ორჯერ არის დამატებული.`);
    }
    classNames.add(normalizedClassName);

    if (!Array.isArray(classItem.subjects) || classItem.subjects.length === 0) {
      errors.push(`ნაბიჯი 1 — ${classItem.name} კლასს არც ერთი საგანი არ აქვს დამატებული.`);
    }

    for (const subject of classItem.subjects || []) {
      if (!subject.name?.trim()) errors.push(`ნაბიჯი 1 — ${classItem.name} კლასში დამატებულია უსახელო საგანი.`);
      if (!Number.isInteger(subject.weeklyLessons) || subject.weeklyLessons < 1 || subject.weeklyLessons > 20) {
        errors.push(`ნაბიჯი 1 — ${classItem.name} კლასის საგანს „${subject.name}“ კვირეული რაოდენობა 1-დან 20-მდე უნდა ჰქონდეს.`);
      }
    }

    if (
      !Number.isInteger(classItem.minLessonsPerDay) ||
      !Number.isInteger(classItem.maxLessonsPerDay) ||
      classItem.minLessonsPerDay < 1 ||
      classItem.maxLessonsPerDay > 10 ||
      classItem.minLessonsPerDay > classItem.maxLessonsPerDay
    ) {
      errors.push(`ნაბიჯი 1 — ${classItem.name} კლასის დღიური მინიმუმი და მაქსიმუმი არასწორია. მიუთითე 1-დან 10-მდე.`);
    }

    if (Number.isFinite(weeklyLessonTotal) && weeklyLessonTotal < classItem.minLessonsPerDay * DAYS.length) {
      errors.push(
        `ნაბიჯი 1 — ${classItem.name} კლასს კვირაში ${weeklyLessonTotal} გაკვეთილი აქვს. დღიური მინიმუმის შესასრულებლად საჭიროა სულ მცირე ${classItem.minLessonsPerDay * DAYS.length}.`,
      );
    }

    if (Number.isFinite(weeklyLessonTotal) && weeklyLessonTotal > classItem.maxLessonsPerDay * DAYS.length) {
      errors.push(
        `ნაბიჯი 1 — ${classItem.name} კლასს კვირაში ${weeklyLessonTotal} გაკვეთილი აქვს, მაგრამ დღიურ მაქსიმუმში მხოლოდ ${classItem.maxLessonsPerDay * DAYS.length} ეტევა.`,
      );
    }

    if (!settings.activeShifts.includes(classItem.shift)) {
      errors.push(`ნაბიჯი 1 — ${classItem.name} კლასს არჩეული აქვს გამორთული სმენა. შეცვალე კლასი ან ჩართე ეს სმენა ნაბიჯი 2-ში.`);
    }

    for (const subject of classItem.subjects || []) {
      if (!subject.name?.trim() || !Number.isInteger(subject.weeklyLessons) || subject.weeklyLessons < 1) continue;
      const eligibleTeachers = state.teachers.filter(
        (teacher) =>
          (teacher.assignments || []).some(
            (assignment) =>
              assignment.name?.toLowerCase() === subject.name.toLowerCase() &&
              (assignment.classes || []).includes(classItem.name),
          ),
      );
      if (eligibleTeachers.length === 0) {
        errors.push(`ნაბიჯი 3 — ${classItem.name} კლასის საგანს „${subject.name}“ შესაბამისი მასწავლებელი არ ჰყავს.`);
        continue;
      }

      const canCheckSlots =
        settings.activeShifts.includes(classItem.shift) &&
        isValidTime(settings.shiftStarts[classItem.shift]) &&
        Number.isFinite(settings.lessonDuration) &&
        settings.lessonDuration > 0 &&
        Number.isInteger(classItem.maxLessonsPerDay) &&
        classItem.maxLessonsPerDay > 0;
      if (!canCheckSlots) continue;

      const slots = buildSlots(classItem, settings);
      const availableDays = DAYS.filter((day) =>
        slots.some((slot) => eligibleTeachers.some((teacher) => teacherCanTeach(teacher, classItem, subject.name, day, slot))),
      );
      const possibleSlotCount = DAYS.reduce(
        (total, day) =>
          total +
          slots.filter((slot) =>
            eligibleTeachers.some((teacher) => teacherCanTeach(teacher, classItem, subject.name, day, slot)),
          ).length,
        0,
      );

      if (subject.weeklyLessons <= DAYS.length && availableDays.length < subject.weeklyLessons) {
        errors.push(
          `ნაბიჯი 3 — ${classItem.name} კლასის „${subject.name}“ კვირაში ${subject.weeklyLessons}-ჯერ უნდა ჩატარდეს, მაგრამ შესაბამის მასწავლებელს მხოლოდ ${availableDays.length} შესაძლო დღე აქვს.`,
        );
      } else if (possibleSlotCount < subject.weeklyLessons) {
        errors.push(
          `ნაბიჯი 3 — ${classItem.name} კლასის „${subject.name}“-ისთვის საჭიროა ${subject.weeklyLessons} გაკვეთილი, მაგრამ მასწავლებლების თავისუფალ დროში მხოლოდ ${possibleSlotCount} შესაძლო საათი მოიძებნა.`,
        );
      }
    }
  }

  return Array.from(new Set(errors));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showValidationError(title, details, focusId = null) {
  showMessages([
    {
      type: "error",
      title,
      text: "შეასწორე ჩამოთვლილი მონაცემები და სცადე თავიდან.",
      details: Array.from(new Set(details)),
    },
  ]);
  if (focusId && $(focusId)) $(focusId).focus();
}

function showMessages(messages) {
  $("messages").innerHTML = messages
    .map(
      (message) => `
        <div class="message ${message.type}">
          ${message.title ? `<strong class="message-title">${escapeHtml(message.title)}</strong>` : ""}
          ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}
          ${
            Array.isArray(message.details) && message.details.length > 0
              ? `<ul>${message.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`
              : ""
          }
        </div>
      `,
    )
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
$("clearAllBtn").addEventListener("click", clearAllData);
$("addSubjectBtn").addEventListener("click", () => addSubject($("subjectDraft").value));
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

  if (event.target.dataset.loadMoreVariants === "true") {
    loadMoreVariants();
    return;
  }

  if (event.target.dataset.keepVariant === "true") {
    keepSelectedVariant();
  }
});

restoreSavedDraft();

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
}

persistDraft();
