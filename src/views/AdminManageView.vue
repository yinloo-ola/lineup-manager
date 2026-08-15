<script setup lang="ts">
// Tournament settings (spec §7 / ticket #15): managing the SELECTED tournament
// — rename, start-date edit, delete. The selector in the app bar owns
// switching; this page deliberately shows no tournament list (the rejected
// design). The start date keys the format freeze (ticket 16) and the selector's
// Active & upcoming grouping, so saving reloads the store and both follow.
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useTournamentStore } from '@/stores/tournament'
import { deleteReady, editUnchanged, renameError } from '@/domain/tournamentManage'

const tournaments = useTournamentStore()
const router = useRouter()
const active = computed(() => tournaments.active)

type Result = { ok: boolean; message: string }
const result = ref<Result | null>(null)

// --- rename / start-date edit (target: the selected tournament) ---
const editing = ref(false)
const editName = ref('')
const editDate = ref('') // yyyy-mm-dd, or '' for "no start date"
const saving = ref(false)

// Names of every OTHER tournament — passed to renameError so keeping the current
// name is always valid, but a case-folded clash with a sibling is blocked.
const editError = computed(() =>
  active.value ? renameError(editName.value, otherNames(active.value)) : 'Name is required'
)
const editIsNoop = computed(() =>
  active.value ? editUnchanged(active.value, { name: editName.value, startDate: editDate.value }) : true
)
const canSave = computed(() => !editError.value && !editIsNoop.value)

function openEdit(): void {
  const t = active.value
  if (!t) return
  editName.value = t.name
  editDate.value = t.startDate ?? ''
  editing.value = true
}

function otherNames(t: { id: string }): string[] {
  return tournaments.tournaments.filter((x) => x.id !== t.id).map((x) => x.name)
}

async function saveEdit(): Promise<void> {
  const t = active.value
  if (!t || !canSave.value) return
  saving.value = true
  try {
    const { error } = await supabase
      .from('tournaments')
      .update({ name: editName.value.trim(), start_date: editDate.value || null })
      .eq('id', t.id)
    if (error) {
      result.value = { ok: false, message: error.message }
      return
    }
    // Reload so the selector's grouping, the shell's freeze anchor, and the
    // app-bar name all pick up the change.
    await tournaments.load()
    editing.value = false
    result.value = { ok: true, message: `Tournament “${editName.value.trim()}” updated.` }
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    saving.value = false
  }
}

// --- delete (double-confirm) ---
const deleting = ref(false)
// Snapshot of the tournament the dialog was opened for — the dialog must confirm
// and delete the SAME tournament even if the selector switches mid-dialog.
const delTarget = ref<{ id: string; name: string } | null>(null)
const delCheckbox = ref(false)
const delText = ref('')
// Manager-account count for the selected tournament (fetched when the dialog
// opens), so the consequence list can name a concrete number being cleared.
const delManagerCount = ref<number | null>(null)
const delBusy = ref(false)

const delCanDelete = computed(() =>
  !!delTarget.value && deleteReady(delText.value, delCheckbox.value, delTarget.value.name)
)

async function openDelete(): Promise<void> {
  const t = active.value
  if (!t) return
  delTarget.value = { id: t.id, name: t.name }
  delCheckbox.value = false
  delText.value = ''
  // null = not loaded yet (or the count failed): the dialog then omits the
  // number rather than asserting a wrong "0" for a destructive confirmation.
  delManagerCount.value = null
  // teams → team_managers count for this tournament.
  try {
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('tournament_id', t.id)
    const teamIds = ((teams as { id: string }[] | null) ?? []).map((x) => x.id)
    let count = 0
    if (teamIds.length > 0) {
      const res = await supabase
        .from('team_managers')
        .select('user_id', { count: 'exact', head: true })
        .in('team_id', teamIds)
      count = res.count ?? 0
    }
    delManagerCount.value = count
  } catch {
    // Leave null — unknown, shown without a number.
  }
}

async function confirmDelete(): Promise<void> {
  const t = delTarget.value
  if (!t || !delCanDelete.value) return
  delBusy.value = true
  try {
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean
      error?: string
      removedAccounts?: number
    }>('delete-tournament', { body: { tournamentId: t.id } })
    if (error) {
      // Non-2xx arrives as FunctionsHttpError whose message is generic; the
      // edge function's real reason is in the response body (error.context).
      let message = error.message
      try {
        const body = await (error as { context?: Response }).context?.json()
        if (body && typeof body.error === 'string') message = body.error
      } catch {
        /* keep the generic message */
      }
      result.value = { ok: false, message }
      return
    }
    if (data?.error) {
      result.value = { ok: false, message: data.error }
      return
    }
    // Reload re-resolves the active tournament: keep it if still present, else
    // fall back to another, or to the empty state when none remain.
    await tournaments.load()
    deleting.value = false
    delTarget.value = null
    if (!tournaments.tournaments.length) {
      // Setup-aware landing rules: with nothing left to manage, the empty
      // state owns the screen (and the import CTA).
      await router.push({ name: 'setup' })
      return
    }
    const cleared = data?.removedAccounts ?? 0
    result.value = {
      ok: true,
      message: `Tournament “${t.name}” deleted${
        cleared > 0 ? ` — ${cleared} manager account(s) cleared` : ''
      }.`
    }
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    delBusy.value = false
  }
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>

<template>
  <v-container>
    <v-alert
      v-if="result"
      :type="result.ok ? 'success' : 'error'"
      variant="tonal"
      class="mt-4"
      closable
      @click:close="result = null"
    >
      {{ result.message }}
    </v-alert>

    <v-card v-if="active" elevation="2" rounded="lg" class="mt-4">
      <v-card-item>
        <v-card-title>{{ active.name }}</v-card-title>
        <v-card-subtitle>Start date: {{ fmtDate(active.startDate) }}</v-card-subtitle>
      </v-card-item>
      <v-divider />
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Rename this tournament, edit its start date, or delete it. To work on a different
          tournament, switch it from the selector in the top right.
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-pencil" @click="openEdit">
            Edit name / start date
          </v-btn>
          <v-btn color="error" variant="tonal" prepend-icon="mdi-delete" @click="openDelete">
            Delete tournament
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card v-else elevation="2" rounded="lg" class="mt-4">
      <v-card-text class="text-center text-medium-emphasis pa-8">
        No tournament selected —
        <v-btn variant="text" color="primary" to="/setup">import one to get started</v-btn>.
      </v-card-text>
    </v-card>

    <!-- Edit (rename + start date) dialog -->
    <v-dialog :model-value="editing" @update:model-value="editing = false" max-width="480">
      <v-card rounded="lg">
        <v-card-item><v-card-title>Edit tournament</v-card-title></v-card-item>
        <v-card-text>
          <v-text-field
            v-model="editName"
            label="Tournament name"
            autofocus
            :error-messages="editError ?? []"
            @keyup.enter="saveEdit"
          />
          <v-text-field
            v-model="editDate"
            label="Start date"
            type="date"
            clearable
            hint="Keys the format freeze once the tournament starts, the Active & upcoming grouping, and 'as of tournament start' age rules. Optional."
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editing = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!canSave" @click="saveEdit">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete dialog: consequences + double-confirm -->
    <v-dialog :model-value="deleting" @update:model-value="deleting = false" max-width="520" persistent>
      <v-card rounded="lg">
        <v-card-item>
          <v-card-title class="text-error">
            <v-icon class="mr-1">mdi-alert</v-icon> Delete tournament
          </v-card-title>
        </v-card-item>
        <v-card-text>
          <p class="mb-3">
            Deleting <strong>{{ delTarget?.name }}</strong> permanently removes, for this
            tournament:
          </p>
          <v-list density="compact" class="bg-grey-lighten-4 rounded">
            <v-list-item>
              <v-icon class="mr-2">mdi-sitemap</v-icon>
              all of its team events, team match formats, teams, players, team matches, and lineups
            </v-list-item>
            <v-divider />
            <v-list-item base-color="error">
              <v-icon class="mr-2" color="error">mdi-account-key</v-icon>
              <strong>all team manager accounts</strong>
              <span v-if="delManagerCount !== null"> ({{ delManagerCount }})</span> will be cleared
            </v-list-item>
          </v-list>
          <p class="text-caption text-medium-emphasis mt-2">
            Those managers will no longer be able to sign in. This cannot be undone.
          </p>

          <v-checkbox
            v-model="delCheckbox"
            hide-details
            class="mt-3"
            label="I understand this cannot be recovered."
          />
          <v-text-field
            v-model="delText"
            class="mt-2"
            :label="`Type ${delTarget?.name ?? ''} to confirm`"
            :error-messages="
              delText && delTarget && delText !== delTarget.name ? ['Name does not match'] : []
            "
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleting = false">Cancel</v-btn>
          <v-btn color="error" :loading="delBusy" :disabled="!delCanDelete" @click="confirmDelete">
            Delete tournament
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
