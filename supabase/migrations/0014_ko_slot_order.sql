-- Ticket #15 (ko-import): bracket position order. Imported slot rows mint
-- fresh random ids, so a round's slot order (QF1..QF4) is otherwise
-- unrecoverable — the bracket view needs it to render slots in bracket order
-- and the derivation is positional. Entry slots and fed later-round slots
-- carry their 1-based slot number; pool and group rows leave it null.

alter table ties add column if not exists bracket_slot int;
