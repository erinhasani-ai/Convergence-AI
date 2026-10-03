// HANDLING-1.0.0: equipment needs derive from the vehicle revision's handling facts. Unknown never becomes "false".
import type { Equipment, VehicleSnapshot } from "@contracts";

export function requiredEquipment(v: VehicleSnapshot): { equipment: Equipment[]; basis: string[] } {
  const equipment: Equipment[] = ["vehicle_slot_open"];
  const basis = ["Every vehicle needs an open car slot."];
  if (v.handling.drivable.state === "known" && v.handling.drivable.value === false) {
    equipment.push("winch");
    basis.push(`Drivable is known false (revision ${v.revision}) → winch required.`);
  }
  if (v.handling.keysPresent.state !== "known") {
    basis.push("Keys unknown → no equipment assumed; loading eligibility stays unknown.");
  }
  return { equipment, basis };
}
