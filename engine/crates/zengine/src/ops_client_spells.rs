//! Bounded source-reference operations; no live session reattachment.
use super::*;

pub(super) fn activate(
    world: &World,
    request: protocol::generated::ClientSpellsActivateRequest,
) -> Outcome {
    let params = request.params;
    match world.activate_client_spells(
        &params.root,
        &params.snapshot_id,
        &params.spells_path,
        &params.dbstr_path,
    ) {
        Ok(applied) => reply(
            request.id,
            ReplyResult::ClientSpellsActivateResult(ClientSpellsActivateResult {
                client_spells_activated: applied,
                root: params.root,
                snapshot_id: params.snapshot_id,
            }),
        ),
        Err(message) => error(request.id, ErrorCode::Unavailable, message),
    }
}

pub(super) fn resist(world: &World, request: protocol::generated::ResistSpellRequest) -> Outcome {
    let name = request.params.name;
    match world.client_spells() {
        None => error(
            request.id,
            ErrorCode::Unavailable,
            "no log is attached, so there is no install to read a spell table beside".to_owned(),
        ),
        Some(spells) => reply(
            request.id,
            ReplyResult::ResistSpellResult(ResistSpellResult {
                spell: spells.spell(&name).map(client_spell),
                spell_name: name,
                table: table_state(&spells),
                path: spells.path().to_string_lossy().into_owned(),
                snapshot_id: spells.snapshot_id().map(str::to_owned),
            }),
        ),
    }
}
