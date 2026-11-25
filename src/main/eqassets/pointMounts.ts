// Luclin hair, helm, and chest pieces hang on point bones. The body and the bare head stay
// skinned. A piece is mounted only when the skeleton has the exact bone `hangPoint` names.

import type { EqModelMesh, EqModelMount } from '../../shared/eqModel'
import { hangPoint } from '../../shared/worth'
import { bindPose, readMesh, type Skeleton, type WldFile } from './wld'

type Point = 'HAIR_POINT' | 'HEAD_POINT' | 'CHEST_POINT'

function boneNamesOf(bones: readonly { name: string }[]): Set<string> {
  const names = new Set<string>()
  for (const bone of bones) names.add(bone.name)
  return names
}

/** The point this mesh hangs on, or null when it stays part of the skinned figure. */
export function pointForPiece(actor: string, meshName: string, bones: readonly { name: string }[]): Point | null {
  const code = actor.replace(/_ACTORDEF$/, '')
  if (meshName === `${code}_DMSPRITEDEF` || meshName === `${code}HE00_DMSPRITEDEF`) return null
  const names = boneNamesOf(bones)
  const helm = new RegExp(`^${code}HE0[1-9]_DMSPRITEDEF$`, 'i').test(meshName)
  const hair = /HAIR/i.test(meshName) && meshName.endsWith('_DMSPRITEDEF')
  const chest = /CHEST/i.test(meshName) && meshName.endsWith('_DMSPRITEDEF')
  const matched: Point | null = helm ? 'HEAD_POINT' : hair ? 'HAIR_POINT' : chest ? 'CHEST_POINT' : null
  if (matched === null || !names.has(hangPoint(actor, matched))) return null
  return matched
}

/** Split worn pieces off the skinned list when their point bone exists. */
export function mountPieces(input: {
  actor: string
  bones: readonly { name: string }[]
  meshes: readonly EqModelMesh[]
  extras: readonly EqModelMesh[]
}): { skinned: EqModelMesh[]; mounts: EqModelMount[] } {
  const skinned: EqModelMesh[] = []
  const mounts: EqModelMount[] = []
  const seen = new Set<string>()
  for (const mesh of input.meshes) seen.add(mesh.name)
  const all: EqModelMesh[] = [...input.meshes]
  for (const mesh of input.extras) {
    if (seen.has(mesh.name)) continue
    seen.add(mesh.name)
    all.push(mesh)
  }
  for (const mesh of all) {
    const point = pointForPiece(input.actor, mesh.name, input.bones)
    if (point) mounts.push({ point, mesh })
    else skinned.push(mesh)
  }
  return { skinned, mounts }
}

/** Meshes in the archive that belong on a point bone and are not already drawn. */
export function pieceMeshes(
  wld: WldFile,
  actor: string,
  skeleton: Skeleton,
  drawn: readonly { name: string }[]
): EqModelMesh[] {
  const have = new Set<string>()
  for (const mesh of drawn) have.add(mesh.name)
  const world = bindPose(skeleton)
  const out: EqModelMesh[] = []
  for (const frag of wld.fragments) {
    if (frag.type !== 0x36 || have.has(frag.name)) continue
    if (!pointForPiece(actor, frag.name, skeleton.bones)) continue
    try {
      out.push(readMesh(wld, frag, world))
    } catch {
      continue
    }
  }
  return out
}
