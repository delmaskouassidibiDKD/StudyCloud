/**
 * StudyCloud - Cloudflare Worker Backend API
 * Gère la communication complète entre StudyCloud, Cloudflare D1 (SQL) et Cloudflare R2 (Storage).
 */

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

// ============================================================================
// Utilitaires HTTP & CORS
// ============================================================================
function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
  };
}

function jsonResponse(data: any, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function errorResponse(error: string, status = 400, origin = '*') {
  return jsonResponse({ success: false, error }, status, origin);
}

// ============================================================================
// Gestionnaire Principal du Worker
// ============================================================================
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '*';

    // Gestion du Preflight CORS
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    try {
      // ----------------------------------------------------------------------
      // Health Check
      // ----------------------------------------------------------------------
      if (path === '/' || path === '/api/health') {
        return jsonResponse({
          success: true,
          service: 'StudyCloud Cloudflare Worker API',
          status: 'online',
          timestamp: new Date().toISOString(),
        }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 1. UTILISATEURS & PROFIL
      // ----------------------------------------------------------------------
      if (path === '/api/users/sync' && method === 'POST') {
        const body: any = await request.json();
        const { id, name, email, school, filiere, avatarUrl } = body;
        if (!id || !email) return errorResponse('ID et email requis', 400, origin);

        await env.DB.prepare(`
          INSERT INTO users (id, name, email, school, filiere, avatar_url, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            school = excluded.school,
            filiere = excluded.filiere,
            avatar_url = excluded.avatar_url,
            updated_at = CURRENT_TIMESTAMP
        `).bind(id, name || 'Étudiant', email, school || 'CME', filiere || 'Général', avatarUrl || null).run();

        // Initialiser les préférences utilisateur si inexistantes
        await env.DB.prepare(`
          INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)
        `).bind(id).run();

        return jsonResponse({ success: true, message: 'Utilisateur synchronisé' }, 200, origin);
      }

      if (path.startsWith('/api/users/') && !path.includes('/preferences') && method === 'GET') {
        const userId = path.split('/')[3];
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        if (!user) return errorResponse('Utilisateur introuvable', 404, origin);
        return jsonResponse({ success: true, data: user }, 200, origin);
      }

      if (path.startsWith('/api/users/') && path.endsWith('/preferences')) {
        const userId = path.split('/')[3];
        if (method === 'GET') {
          const prefs = await env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(userId).first();
          return jsonResponse({ success: true, data: prefs || { view_mode: 'grid', is_dark_mode: 0, current_tab: 'folders' } }, 200, origin);
        }
        if (method === 'PUT') {
          const body: any = await request.json();
          await env.DB.prepare(`
            INSERT INTO user_preferences (user_id, view_mode, is_dark_mode, current_tab, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              view_mode = COALESCE(excluded.view_mode, user_preferences.view_mode),
              is_dark_mode = COALESCE(excluded.is_dark_mode, user_preferences.is_dark_mode),
              current_tab = COALESCE(excluded.current_tab, user_preferences.current_tab),
              updated_at = CURRENT_TIMESTAMP
          `).bind(userId, body.view_mode || 'grid', body.is_dark_mode ?? 0, body.current_tab || 'folders').run();
          return jsonResponse({ success: true, message: 'Préférences enregistrées' }, 200, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 2. MATIÈRES & DOSSIERS
      // ----------------------------------------------------------------------
      if (path === '/api/matieres') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM matieres WHERE user_id = ? ORDER BY display_order ASC, name ASC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }

        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, name, coefficient, color, category, displayOrder } = body;
          if (!id || !userId || !name) return errorResponse('id, userId et name requis', 400, origin);

          await env.DB.prepare(`
            INSERT INTO matieres (id, user_id, name, coefficient, color, category, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(id, userId, name, coefficient ?? 1.0, color || '#EA580C', category || 'Général', displayOrder ?? 0).run();

          return jsonResponse({ success: true, data: { id, name } }, 201, origin);
        }
      }

      if (path.startsWith('/api/matieres/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM matieres WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Matière supprimée' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 3. FICHIERS (Métadonnées & Fichiers de cours)
      // ----------------------------------------------------------------------
      if (path === '/api/files') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          const matiereId = url.searchParams.get('matiereId');
          if (!userId) return errorResponse('userId requis', 400, origin);

          let query = 'SELECT * FROM files WHERE user_id = ?';
          const params: any[] = [userId];

          if (matiereId !== null && matiereId !== undefined) {
            query += ' AND matiere_id = ?';
            params.push(matiereId);
          }
          query += ' ORDER BY created_at DESC';

          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }

        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, matiereId, name, size, type, extension, r2Key, fileUrl, isFavorite, isImported } = body;
          if (!id || !userId || !name || !r2Key) return errorResponse('Champs obligatoires manquants', 400, origin);

          await env.DB.prepare(`
            INSERT INTO files (id, user_id, matiere_id, name, size, type, extension, r2_key, file_url, is_favorite, is_imported)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, userId, matiereId || null, name, size || 0, type || 'application/octet-stream', extension || '', r2Key, fileUrl || '', isFavorite ? 1 : 0, isImported ? 1 : 0).run();

          return jsonResponse({ success: true, data: { id, name } }, 201, origin);
        }
      }

      if (path.startsWith('/api/files/') && method === 'DELETE') {
        const id = path.split('/')[3];
        const file = await env.DB.prepare('SELECT r2_key FROM files WHERE id = ?').bind(id).first<any>();
        if (file && file.r2_key && env.BUCKET) {
          try { await env.BUCKET.delete(file.r2_key); } catch (e) {}
        }
        await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Fichier supprimé' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 4. STOCKAGE CLOUDFLARE R2 (Upload & Téléchargement direct)
      // ----------------------------------------------------------------------
      if (path === '/api/storage/upload' && method === 'PUT') {
        const key = url.searchParams.get('key');
        if (!key) return errorResponse('Clé de stockage manquante', 400, origin);
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

        const fileBlob = await request.arrayBuffer();
        await env.BUCKET.put(key, fileBlob, {
          httpMetadata: { contentType },
        });

        const fileUrl = `${url.origin}/api/storage/file/${encodeURIComponent(key)}`;
        return jsonResponse({ success: true, key, url: fileUrl }, 200, origin);
      }

      if (path.startsWith('/api/storage/file/') && method === 'GET') {
        const key = decodeURIComponent(path.replace('/api/storage/file/', ''));
        const object = await env.BUCKET.get(key);
        if (!object) return errorResponse('Fichier introuvable dans R2', 404, origin);

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Access-Control-Allow-Origin', origin);

        return new Response(object.body, { headers });
      }

      // ----------------------------------------------------------------------
      // 5. PARTAGES & LIENS PUBLICS
      // ----------------------------------------------------------------------
      if (path === '/api/shares') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM shared_folders WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }

        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, title, description, category, authorName, school, isPasswordProtected, passwordHash, totalSize, files } = body;
          if (!id || !userId || !title) return errorResponse('Champs obligatoires manquants', 400, origin);

          await env.DB.prepare(`
            INSERT INTO shared_folders (id, user_id, title, description, category, author_name, school, is_password_protected, password_hash, total_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, userId, title, description || '', category || 'Cours', authorName || 'Étudiant', school || '', isPasswordProtected ? 1 : 0, passwordHash || null, totalSize || 0).run();

          if (Array.isArray(files)) {
            for (const f of files) {
              await env.DB.prepare(`
                INSERT INTO shared_folder_files (id, shared_folder_id, file_id, name, size, type, r2_key, file_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(f.id || crypto.randomUUID(), id, f.fileId || null, f.name, f.size || 0, f.type || 'file', f.r2Key || null, f.url || '').run();
            }
          }

          return jsonResponse({ success: true, id }, 201, origin);
        }
      }

      if (path.startsWith('/api/shares/') && method === 'GET') {
        const shareId = path.split('/')[3];
        const folder = await env.DB.prepare('SELECT * FROM shared_folders WHERE id = ?').bind(shareId).first<any>();
        if (!folder) return errorResponse('Partage introuvable', 404, origin);

        // Incrémenter le compteur de vues
        await env.DB.prepare('UPDATE shared_folders SET views_count = views_count + 1 WHERE id = ?').bind(shareId).run();

        // Récupérer les fichiers liés
        const { results: files } = await env.DB.prepare('SELECT * FROM shared_folder_files WHERE shared_folder_id = ?').bind(shareId).all();

        return jsonResponse({
          success: true,
          data: {
            ...folder,
            files: folder.is_password_protected ? [] : files, // Masquer les fichiers si mot de passe requis
            requiresPassword: !!folder.is_password_protected,
          },
        }, 200, origin);
      }

      if (path.includes('/verify-pin') && method === 'POST') {
        const shareId = path.split('/')[3];
        const { pin } = (await request.json()) as any;
        const folder = await env.DB.prepare('SELECT * FROM shared_folders WHERE id = ?').bind(shareId).first<any>();
        if (!folder) return errorResponse('Dossier partagé introuvable', 404, origin);

        if (folder.password_hash !== pin) {
          return errorResponse('Code PIN incorrect', 401, origin);
        }

        const { results: files } = await env.DB.prepare('SELECT * FROM shared_folder_files WHERE shared_folder_id = ?').bind(shareId).all();
        return jsonResponse({ success: true, data: { ...folder, files } }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 6. EMPLOI DU TEMPS
      // ----------------------------------------------------------------------
      if (path === '/api/schedule/config') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const config = await env.DB.prepare('SELECT * FROM schedule_config WHERE user_id = ?').bind(userId).first();
          return jsonResponse({ success: true, data: config }, 200, origin);
        }
        if (method === 'PUT') {
          const body: any = await request.json();
          await env.DB.prepare(`
            INSERT INTO schedule_config (user_id, days_json, hours_json, zoom_level, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              days_json = COALESCE(excluded.days_json, schedule_config.days_json),
              hours_json = COALESCE(excluded.hours_json, schedule_config.hours_json),
              zoom_level = COALESCE(excluded.zoom_level, schedule_config.zoom_level),
              updated_at = CURRENT_TIMESTAMP
          `).bind(body.userId, body.daysJson, body.hoursJson, body.zoomLevel ?? 100).run();
          return jsonResponse({ success: true, message: 'Configuration mise à jour' }, 200, origin);
        }
      }

      if (path === '/api/schedule/slots') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM schedule_slots WHERE user_id = ?').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, day, hourSlot, subject, room, noteOrTeacher, color } = body;
          await env.DB.prepare(`
            INSERT INTO schedule_slots (id, user_id, day, hour_slot, subject, room, note_or_teacher, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, day, hourSlot, subject, room || '', noteOrTeacher || '', color || '#EA580C').run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 7. CARNET DE NOTES & BULLETINS
      // ----------------------------------------------------------------------
      if (path === '/api/grades') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM grades WHERE user_id = ?').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, trimester, subjectName, coefficient, subGradesJson, average } = body;
          await env.DB.prepare(`
            INSERT INTO grades (id, user_id, trimester, subject_name, coefficient, sub_grades_json, average, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              sub_grades_json = excluded.sub_grades_json,
              average = excluded.average,
              updated_at = CURRENT_TIMESTAMP
          `).bind(id || crypto.randomUUID(), userId, trimester || 1, subjectName, coefficient || 1.0, subGradesJson || '[]', average || 0.0).run();
          return jsonResponse({ success: true }, 200, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 8. BLOC-NOTES (Keep Notes)
      // ----------------------------------------------------------------------
      if (path === '/api/notes') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, title, content, color, isPinned, imageUrl } = body;
          await env.DB.prepare(`
            INSERT INTO notes (id, user_id, title, content, color, is_pinned, image_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              content = excluded.content,
              color = excluded.color,
              is_pinned = excluded.is_pinned,
              image_url = excluded.image_url,
              updated_at = CURRENT_TIMESTAMP
          `).bind(id || crypto.randomUUID(), userId, title, content || '', color || '#FFFFFF', isPinned ? 1 : 0, imageUrl || null).run();
          return jsonResponse({ success: true }, 200, origin);
        }
      }

      if (path.startsWith('/api/notes/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Note supprimée' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 9. CALENDRIER DES ÉVÉNEMENTS
      // ----------------------------------------------------------------------
      if (path === '/api/calendar') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_date ASC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, title, startDate, endDate, allDay, color, description, location } = body;
          await env.DB.prepare(`
            INSERT INTO calendar_events (id, user_id, title, start_date, end_date, all_day, color, description, location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, title, startDate, endDate || null, allDay ? 1 : 0, color || '#EA580C', description || '', location || '').run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 10. ALARMES & SESSIONS D'ÉTUDE
      // ----------------------------------------------------------------------
      if (path === '/api/alarms') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM alarms WHERE user_id = ? ORDER BY time ASC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, time, label, isActive, daysJson } = body;
          await env.DB.prepare(`
            INSERT INTO alarms (id, user_id, time, label, is_active, days_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, time, label || 'Réveil étude', isActive ? 1 : 0, daysJson || '["Tous les jours"]').run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      if (path === '/api/study-sessions') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM study_sessions WHERE user_id = ? ORDER BY completed_at DESC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, durationSeconds, matiereName } = body;
          await env.DB.prepare(`
            INSERT INTO study_sessions (id, user_id, duration_seconds, matiere_name)
            VALUES (?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, durationSeconds, matiereName || '').run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 11. BOUTIQUE ÉTUDIANTE, PRODUITS & PANIER
      // ----------------------------------------------------------------------
      if (path === '/api/shop/profile') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const profile = await env.DB.prepare('SELECT * FROM shop_profiles WHERE user_id = ?').bind(userId).first();
          return jsonResponse({ success: true, data: profile || { shop_name: 'DKD Technologies', shop_phone: '+225 07 00 00 00 00', shop_whatsapp: '+225 07 00 00 00 00' } }, 200, origin);
        }
        if (method === 'PUT') {
          const body: any = await request.json();
          await env.DB.prepare(`
            INSERT INTO shop_profiles (user_id, shop_name, shop_phone, shop_whatsapp, shop_avatar_url, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              shop_name = excluded.shop_name,
              shop_phone = excluded.shop_phone,
              shop_whatsapp = excluded.shop_whatsapp,
              shop_avatar_url = excluded.shop_avatar_url,
              updated_at = CURRENT_TIMESTAMP
          `).bind(body.userId, body.shopName, body.shopPhone, body.shopWhatsapp, body.shopAvatarUrl || null).run();
          return jsonResponse({ success: true, message: 'Profil boutique mis à jour' }, 200, origin);
        }
      }

      if (path === '/api/products') {
        if (method === 'GET') {
          const category = url.searchParams.get('category');
          let query = 'SELECT * FROM products';
          const params: any[] = [];
          if (category && category !== 'Tous') {
            query += ' WHERE category = ?';
            params.push(category);
          }
          query += ' ORDER BY is_boosted DESC, created_at DESC';
          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, sellerId, title, description, price, category, imageUrlsJson, isBoosted, boostFormula, boostViewsTarget, boostEndDate } = body;
          await env.DB.prepare(`
            INSERT INTO products (id, seller_id, title, description, price, category, image_urls_json, is_boosted, boost_formula, boost_views_target, boost_end_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), sellerId, title, description || '', price, category || 'Électronique', imageUrlsJson || '[]', isBoosted ? 1 : 0, boostFormula || null, boostViewsTarget || 0, boostEndDate || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      if (path === '/api/cart') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare(`
            SELECT c.id as cart_item_id, c.quantity, p.*
            FROM cart_items c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
            ORDER BY c.added_at DESC
          `).bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { userId, productId, quantity } = body;
          await env.DB.prepare(`
            INSERT INTO cart_items (id, user_id, product_id, quantity)
            VALUES (?, ?, ?, ?)
          `).bind(crypto.randomUUID(), userId, productId, quantity || 1).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 12. PUBLICATION UNIVERSITAIRE (Bibliothèque Publique)
      // ----------------------------------------------------------------------
      if (path === '/api/published-documents') {
        if (method === 'GET') {
          const school = url.searchParams.get('school');
          const filiere = url.searchParams.get('filiere');
          let query = 'SELECT * FROM published_documents WHERE 1=1';
          const params: any[] = [];
          if (school) { query += ' AND school = ?'; params.push(school); }
          if (filiere) { query += ' AND filiere = ?'; params.push(filiere); }
          query += ' ORDER BY created_at DESC';
          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, title, description, school, filiere, category, infoMode, fileName, fileSize, fileType, r2Key } = body;
          await env.DB.prepare(`
            INSERT INTO published_documents (id, user_id, title, description, school, filiere, category, info_mode, file_name, file_size, file_type, r2_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, title, description || '', school || '', filiere || '', category || 'Cours', infoMode || 'all', fileName, fileSize || 0, fileType || '', r2Key).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 13. NOTIFICATIONS
      // ----------------------------------------------------------------------
      if (path === '/api/notifications') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, title, description, itemRef } = body;
          await env.DB.prepare(`
            INSERT INTO notifications (id, user_id, title, description, item_ref)
            VALUES (?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, title, description, itemRef || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 14. ASSISTANT DELMAS (Chat Messages)
      // ----------------------------------------------------------------------
      if (path === '/api/chat') {
        const userId = url.searchParams.get('userId');
        const sessionId = url.searchParams.get('sessionId');
        if (method === 'GET') {
          if (!userId || !sessionId) return errorResponse('userId et sessionId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC').bind(userId, sessionId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, sessionId, sender, messageText, attachedResourceId } = body;
          await env.DB.prepare(`
            INSERT INTO chat_messages (id, user_id, session_id, sender, message_text, attached_resource_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, sessionId, sender, messageText, attachedResourceId || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 15. ABONNEMENTS & FORMULES
      // ----------------------------------------------------------------------
      if (path === '/api/subscriptions') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const sub = await env.DB.prepare('SELECT * FROM user_subscriptions WHERE user_id = ? AND status = "active"').bind(userId).first();
          return jsonResponse({ success: true, data: sub || { plan_name: 'free', status: 'active' } }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, planName, billingCycle, expiresAt } = body;
          await env.DB.prepare(`
            INSERT INTO user_subscriptions (id, user_id, plan_name, billing_cycle, status, expires_at)
            VALUES (?, ?, ?, ?, 'active', ?)
          `).bind(id || crypto.randomUUID(), userId, planName, billingCycle || 'monthly', expiresAt || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // Route 404 par défaut
      return errorResponse(`Route non trouvée : ${method} ${path}`, 404, origin);

    } catch (err: any) {
      console.error('Worker API Error:', err);
      return errorResponse(err.message || 'Erreur interne du serveur', 500, origin);
    }
  },
};
