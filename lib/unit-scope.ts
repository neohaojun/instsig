import type { UnitMembershipRecord, UnitRecord } from "@/lib/types";

export function getUnitLabel(unit: Pick<UnitRecord, "code">) {
  if (unit.code === "WAC" || unit.code === "TAC") return `SVTS ${unit.code}`;
  return unit.code;
}

export function getDescendantUnitIds(units: UnitRecord[], rootUnitId: string) {
  const descendants = new Set<string>([rootUnitId]);
  let changed = true;

  while (changed) {
    changed = false;
    units.forEach((unit) => {
      if (unit.parent_unit_id && descendants.has(unit.parent_unit_id) && !descendants.has(unit.id)) {
        descendants.add(unit.id);
        changed = true;
      }
    });
  }

  return descendants;
}

export function getAccessibleUnitIds(units: UnitRecord[], memberships: UnitMembershipRecord[]) {
  const accessible = new Set<string>();
  memberships
    .filter((membership) => membership.membership_role === "unit_admin" || membership.membership_role === "unit_viewer")
    .forEach((membership) => {
      getDescendantUnitIds(units, membership.unit_id).forEach((unitId) => accessible.add(unitId));
    });
  return accessible;
}

export function getBatchUnitIds(units: UnitRecord[]) {
  const parentUnitIds = new Set(
    units.flatMap((unit) => (unit.parent_unit_id ? [unit.parent_unit_id] : [])),
  );

  return new Set(units.filter((unit) => !parentUnitIds.has(unit.id)).map((unit) => unit.id));
}

export function getUnitDepth(unit: UnitRecord, unitsById: Record<string, UnitRecord | undefined>) {
  let depth = 0;
  let parentId = unit.parent_unit_id;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    depth += 1;
    parentId = unitsById[parentId]?.parent_unit_id ?? null;
  }
  return depth;
}
