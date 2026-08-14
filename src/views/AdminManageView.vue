<script setup lang="ts">
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useTournamentStore, type Tournament } from '@/stores/tournament'
import { renameError } from '@/domain/tournamentManage'
import TournamentSelector from '@/components/TournamentSelector.vue'

// Ticket #15: the Administrator manages tournaments — rename (uniqueness-checked),
// set/edit start date, and delete (cascade + manager-account cleanup). Delete is
// the one operation the browser client can't do alone (removing auth accounts
// needs the service role), so it goes through the delete-tournament edge function.

const tournaments = useTournamentStore()

type Result = { ok: boolean; message: string }
const result = ref<Result | null>(null)

// --- rename / start-date edit ---
const editTarget = ref<Tournament | null>(null)
const editName = ref('')
const editDate = ref('') // yyyy-mm-dd, or '' for "no start date"
const saving = ref(false)

// Names of every OTHER tournament — passed to renameError so keeping the current
// name is always valid, but a case-folded clash with a sibling is blocked.
const editError = computed(() =>
  editTarget.value ? renameError(editName.value, otherNames(editTarget.value)) : 'Name is required'
)
const editUnchanged = computed(() => {
  if (!editTarget.value) return true
  const sameName = editName.value.trim() === editTarget.value.name
  const currentDate = editTarget.value.startDate ?? ''
  return sameName && editDate.value === currentDate
})

function openEdit(t: Tournament): void {
  editTarget.value = t
  editName.value = t.name
  editDate.value = t.startDate ?? ''
}

function otherNames(t: Tournament): string[] {
  return tournaments.tournaments.filter((x) => x.id !== t.id).map((x) => x.name)
}

async function saveEdit(): Promise<void> {
  const t = editTarget.value
  if (!t || editError.value || editUnchanged.value) return
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
    await tournaments.load()
    editTarget.value = null
    result.value = { ok: true, message: `Tournament “${editName.value.trim()}” updated.` }
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    saving.value = false
  }
}

// --- delete (double-confirm) ---
const delTarget = ref<Tournament | null>(null)
const delCheckbox = ref(false)
const delText = ref('')
// Manager-account count for the targeted tournament (fetched when the dialog
// opens), so the consequence list can name a concrete number being cleared.
const delManagerCount = ref<number | null>(null)
const delBusy = ref(false)

const delCanDelete = computed(
  () => !!delTarget.value && delCheckbox.value && delText.value === delTarget.value.name
)

async function openDelete(t: Tournament): Promise<void> {
  delTarget.value = t
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
    delTarget.value = null
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
    <v-app-bar flat color="surface">
      <v-app-bar-title>Manage tournaments</v-app-bar-title>
      <TournamentSelector class="mr-2" />
      <template #append>
        <v-btn variant="text" to="/">Home</v-btn>
      </template>
    </v-app-bar>

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

    <v-card elevation="2" rounded="lg" class="mt-4">
      <v-card-item>
        <v-card-title>Tournaments</v-card-title>
        <v-card-subtitle>
          Rename a tournament (names must be unique), set its start date, or delete one entirely.
        </v-card-subtitle>
      </v-card-item>
      <v-divider />
      <v-list v-if="tournaments.tournaments.length" lines="two">
        <v-list-item v-for="t in tournaments.tournaments" :key="t.id">
          <template #prepend><v-icon>mdi-trophy</v-icon></template>
          <v-list-item-title>{{ t.name }}</v-list-item-title>
          <v-list-item-subtitle>Start date: {{ fmtDate(t.startDate) }}</v-list-item-subtitle>
          <template #append>
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              :aria-label="`Edit ${t.name}`"
              title="Edit name / start date"
              @click="openEdit(t)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              :aria-label="`Delete ${t.name}`"
              title="Delete tournament"
              @click="openDelete(t)"
            />
          </template>
        </v-list-item>
      </v-list>
      <v-card-text v-else class="text-center text-medium-emphasis pa-8">
        No tournaments yet —
        <v-btn variant="text" color="primary" to="/import">import one to get started</v-btn>.
      </v-card-text>
    </v-card>

    <!-- Edit (rename + start date) dialog -->
    <v-dialog :model-value="!!editTarget" @update:model-value="editTarget = null" max-width="480">
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
            hint="Anchors 'as of tournament start' age rules. Optional."
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editTarget = null">Cancel</v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!!editError || editUnchanged"
            @click="saveEdit"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete dialog: consequences + double-confirm -->
    <v-dialog :model-value="!!delTarget" @update:model-value="delTarget = null" max-width="520" persistent>
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
          <v-btn variant="text" @click="delTarget = null">Cancel</v-btn>
          <v-btn color="error" :loading="delBusy" :disabled="!delCanDelete" @click="confirmDelete">
            Delete tournament
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
