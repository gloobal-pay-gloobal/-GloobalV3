// src/domain/disputes/disputeCodes.js
var DISPUTE_STATUS = {
  OPEN: "open",
  IN_CONVERSATION: "in_conversation",
  DECLINED: "declined",
  EXPIRED: "expired",
  ESCALATED: "escalated",
  RESOLVED: "resolved"
};
var DISPUTE_ERROR = {
  OUTSIDE_COMPLAINT_WINDOW: "OUTSIDE_COMPLAINT_WINDOW",
  ALREADY_OPEN: "ALREADY_OPEN",
  NOT_FOUND: "NOT_FOUND",
  INVALID_TRANSITION: "INVALID_TRANSITION"
};

