// Hardcoded to match the owner's paper checklist (spec Section 4a).
// Changing wording here only affects new entries — past entries keep the
// checked_items keys they were submitted with, so nothing historical shifts.
export interface ChecklistItem {
  key: string;
  section: string;
  text: string;
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: "washers_dryers_collected",
    section: "Washers and Dryers",
    text: "Collect coins from all washers and record totals.",
  },
  {
    key: "dryers_collected",
    section: "Washers and Dryers",
    text: "Collect coins from all dryers and record totals.",
  },
  {
    key: "vending_collected",
    section: "Washers and Dryers",
    text: "Remove all cash and coins from snack and soda vending machines and record totals.",
  },
  {
    key: "changer_cash_to_pouch",
    section: "Money changers",
    text: "Open and remove cash from changers; put cash into zipper bank pouch; put pouch into the safe until ready to leave.",
  },
  {
    key: "changer_refill_coin_boxes",
    section: "Money changers",
    text: "Refill coin boxes in changers.",
  },
  {
    key: "leftover_coins_to_safe",
    section: "Money changers",
    text: "Put leftover coins into containers in the safe.",
  },
  {
    key: "check_staff_container_balance",
    section: "Money changers",
    text: "Check the balance of coins in the small container used for staff use.",
  },
  {
    key: "leave_40_start_new_balance",
    section: "Money changers",
    text: "Leave at least $40 in that container and start a new balance paper.",
  },
  {
    key: "check_lock_box_cash",
    section: "Money changers",
    text: "Check cash in the lock box.",
  },
  {
    key: "bank_deposit",
    section: "Money changers",
    text: "Take cash to the bank deposit.",
  },
];
