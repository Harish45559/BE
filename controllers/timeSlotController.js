const { TimeSlotSettings } = require("../models");
const { DateTime } = require("luxon");

// ─── Helper: generate slots for one window ───────────────────────────────────
function generateWindowSlots(date, openTime, closeTime, settings) {
  const { slot_interval_minutes, prep_time_minutes } = settings;
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);

  const opening = DateTime.fromISO(date, { zone: "Europe/London" }).set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
  const closing = DateTime.fromISO(date, { zone: "Europe/London" }).set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });

  const now = DateTime.now().setZone("Europe/London");
  const earliest = now.plus({ minutes: prep_time_minutes });

  const slots = [];
  let cursor = opening;
  while (cursor <= closing) {
    const isToday = cursor.hasSame(now, "day");
    if (!isToday || cursor >= earliest) {
      slots.push(cursor.toFormat("HH:mm"));
    }
    cursor = cursor.plus({ minutes: slot_interval_minutes });
  }
  return slots;
}

// ─── Helper: generate slots for the active window only ───────────────────────
function generateSlots(date, settings) {
  const toMins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const now = DateTime.now().setZone("Europe/London");
  const nowMins = now.hour * 60 + now.minute;

  const bOpen  = settings.breakfast_opening_time || "09:00";
  const bClose = settings.breakfast_closing_time || "12:00";
  const dOpen  = settings.opening_time           || "17:15";
  const dClose = settings.closing_time           || "22:45";

  const inBreakfast = nowMins >= toMins(bOpen) && nowMins <= toMins(bClose);
  const inDinner    = nowMins >= toMins(dOpen) && nowMins <= toMins(dClose);

  // For future dates always show all slots from both windows
  const isToday = DateTime.fromISO(date, { zone: "Europe/London" }).hasSame(now, "day");

  if (!isToday) {
    const breakfast = generateWindowSlots(date, bOpen, bClose, settings);
    const dinner    = generateWindowSlots(date, dOpen, dClose, settings);
    return [...breakfast, ...dinner];
  }

  // Today — only show the current active window
  if (inBreakfast) return generateWindowSlots(date, bOpen, bClose, settings);
  if (inDinner)    return generateWindowSlots(date, dOpen, dClose, settings);

  // Between windows or outside all windows — show next upcoming window
  if (nowMins < toMins(bOpen)) return generateWindowSlots(date, bOpen, bClose, settings);
  if (nowMins < toMins(dOpen)) return generateWindowSlots(date, dOpen, dClose, settings);
  return []; // past closing time
}

// ─── GET /api/customer/timeslots?date=YYYY-MM-DD ─────────────────────────────
// Public — returns available pickup slots for a given date
exports.getSlots = async (req, res) => {
  try {
    const date = req.query.date || DateTime.now().setZone("Europe/London").toISODate();

    // Validate date format
    const parsed = DateTime.fromISO(date, { zone: "Europe/London" });
    if (!parsed.isValid) {
      return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD" });
    }

    // Don't allow dates in the past
    const today = DateTime.now().setZone("Europe/London").startOf("day");
    if (parsed.startOf("day") < today) {
      return res.status(400).json({ success: false, message: "Cannot book slots in the past" });
    }

    const settings = await getOrCreateSettings();
    const slots = generateSlots(date, settings);

    return res.status(200).json({
      success: true,
      date,
      slot_interval_minutes: settings.slot_interval_minutes,
      slots,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Get slots error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to get time slots" });
  }
};

// ─── GET /api/orders/timeslot-settings ───────────────────────────────────────
// Staff — get current settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return res.status(200).json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to get settings" });
  }
};

// ─── PUT /api/orders/timeslot-settings ───────────────────────────────────────
// Staff — update slot interval, opening/closing time, prep buffer
exports.updateSettings = async (req, res) => {
  try {
    const { slot_interval_minutes, opening_time, closing_time, prep_time_minutes } = req.body || {};

    const settings = await getOrCreateSettings();

    // Validate interval — must be positive integer
    if (slot_interval_minutes !== undefined) {
      const val = parseInt(slot_interval_minutes);
      if (isNaN(val) || val < 5) {
        return res.status(400).json({ success: false, message: "slot_interval_minutes must be at least 5" });
      }
      settings.slot_interval_minutes = val;
    }

    // Validate time format HH:mm
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (opening_time !== undefined) {
      if (!timeRegex.test(opening_time)) {
        return res.status(400).json({ success: false, message: "opening_time must be HH:mm format" });
      }
      settings.opening_time = opening_time;
    }

    if (closing_time !== undefined) {
      if (!timeRegex.test(closing_time)) {
        return res.status(400).json({ success: false, message: "closing_time must be HH:mm format" });
      }
      settings.closing_time = closing_time;
    }

    if (prep_time_minutes !== undefined) {
      const val = parseInt(prep_time_minutes);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ success: false, message: "prep_time_minutes must be 0 or greater" });
      }
      settings.prep_time_minutes = val;
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Time slot settings updated",
      settings,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Update timeslot settings error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to update settings" });
  }
};

// ─── PATCH /api/orders/timeslot-settings/interval ────────────────────────────
// Staff — quickly increase or decrease slot interval
// Body: { action: "increase" | "decrease", step: 15 }
exports.adjustInterval = async (req, res) => {
  try {
    const { action, step = 15 } = req.body || {};

    if (!["increase", "decrease"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'increase' or 'decrease'" });
    }

    const stepVal = parseInt(step);
    if (isNaN(stepVal) || stepVal < 1) {
      return res.status(400).json({ success: false, message: "step must be a positive number" });
    }

    const settings = await getOrCreateSettings();
    const current = settings.slot_interval_minutes;

    if (action === "increase") {
      settings.slot_interval_minutes = current + stepVal;
    } else {
      const newVal = current - stepVal;
      if (newVal < 5) {
        return res.status(400).json({
          success: false,
          message: `Cannot decrease below 5 minutes. Current: ${current}min`,
        });
      }
      settings.slot_interval_minutes = newVal;
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: `Interval ${action}d to ${settings.slot_interval_minutes} minutes`,
      slot_interval_minutes: settings.slot_interval_minutes,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to adjust interval" });
  }
};

// ─── Internal helper ──────────────────────────────────────────────────────────
async function getOrCreateSettings() {
  let settings = await TimeSlotSettings.findByPk(1);
  if (!settings) {
    settings = await TimeSlotSettings.create({ id: 1 }); // uses all defaults
  }
  return settings;
}
