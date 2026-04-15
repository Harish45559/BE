const { TimeSlotSettings } = require("../models");
const { DateTime } = require("luxon");

// ─── Helper: generate slots for a given date ─────────────────────────────────
function generateSlots(date, settings) {
  const { slot_interval_minutes, opening_time, closing_time, prep_time_minutes } = settings;

  const [openH, openM] = opening_time.split(":").map(Number);
  const [closeH, closeM] = closing_time.split(":").map(Number);

  // Build opening and closing DateTime in UK time
  const opening = DateTime.fromISO(date, { zone: "Europe/London" }).set({
    hour: openH,
    minute: openM,
    second: 0,
    millisecond: 0,
  });
  const closing = DateTime.fromISO(date, { zone: "Europe/London" }).set({
    hour: closeH,
    minute: closeM,
    second: 0,
    millisecond: 0,
  });

  // Earliest bookable time = now + prep buffer (only relevant for today)
  const now = DateTime.now().setZone("Europe/London");
  const earliest = now.plus({ minutes: prep_time_minutes });

  const slots = [];
  let cursor = opening;

  while (cursor <= closing) {
    // For today: skip slots that are already too soon
    const isToday = cursor.hasSame(now, "day");
    if (!isToday || cursor >= earliest) {
      slots.push(cursor.toFormat("HH:mm"));
    }
    cursor = cursor.plus({ minutes: slot_interval_minutes });
  }

  return slots;
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
