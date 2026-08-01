/**
 * All possible history entry types.
 *
 * IMPORTANT: This is exhaustive. If you add a new type:
 * 1. Add it here
 * 2. Add a corresponding *HistoryType.ts file in history-types/
 * 3. Update any switch statements (TypeScript will error until you do)
 *
 * @antipattern Do NOT rename these string values without a database migration —
 *   existing history entries use these as stored type discriminators.
 */
export type HistoryType =
  // Internal states
  | 'thought'           // 💭 Private contemplation
  | 'curiosity'         // 🔍 Wonder/question
  | 'exist'             // 😌 Simple existence moment
  | 'state_update'      // 🔄 Internal state (meter) change

  // Communication
  | 'message_to_user'    // 📤 Message sent to user
  | 'user_message'      // 👤 Message from user

  // Creative
  | 'art_request'       // 🎨 Art generation request
  | 'art_result'        // 🖼️ Generated artwork (entity)
  | 'user_art'          // 🎨 Generated artwork (user via UI)
  | 'art_shared'        // 🖼️ Shared artwork
  | 'user_video'        // 🎬 Video from user

  // Search
  | 'search_query'      // 🔎 Search initiated
  | 'search_result'     // 📰 Search results

  // Memory operations
  | 'cold_storage'      // 🧊 Frozen to cold storage
  | 'note_saved'        // 📓 Notebook entry created
  | 'note_retrieved'    // 📖 Notebook entry retrieved
  | 'observation_saved' // 👁️ Observation created
  | 'observation_retrieved' // 👁️ Observation retrieved
  | 'remember'          // 📝 Ephemeral remember note

  // System
  | 'meter_override';   // ⚡ Manual meter adjustment (user)
