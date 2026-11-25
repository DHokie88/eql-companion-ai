import { hangPoint } from '../../../../shared/worth'

/** Luclin pieces hang on these bones, by the short name inside `<actor><point>_DAG`. */
export const POINT_BONES = ['HAIR_POINT', 'HEAD_POINT', 'CHEST_POINT'] as const
export type PointBone = (typeof POINT_BONES)[number]

export function mountBoneName(actor: string, point: string): string {
  return hangPoint(actor, point)
}

export function isPointBone(point: string): point is PointBone {
  return (POINT_BONES as readonly string[]).includes(point)
}

/** Hang each mesh on the exact point bone. A missing bone is skipped. Returns the bones that received a mesh. */
export function attachPointMounts<T>(
  bones: readonly { name: string; add: (mesh: T) => void }[],
  actor: string,
  mounts: readonly { point: string; mesh: T }[]
): string[] {
  const attached: string[] = []
  for (const mount of mounts) {
    if (!isPointBone(mount.point)) continue
    const name = mountBoneName(actor, mount.point)
    const bone = bones.find((candidate) => candidate.name === name)
    if (!bone) continue
    bone.add(mount.mesh)
    attached.push(bone.name)
  }
  return attached
}
