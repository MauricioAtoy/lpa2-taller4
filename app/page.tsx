'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Disc3, Heart, Headphones, Library, ListMusic, Music2, Pencil, Plus, Search, Trash2, Users, X, ChevronLeft, ChevronRight, Moon, Sun, AlertCircle, LoaderCircle, Sparkles, MoreHorizontal } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { ApiError, api, isDemoMode, type Cancion, type CancionInput, type Usuario, type UsuarioInput } from '@/lib/api'

type Section = 'canciones' | 'usuarios' | 'favoritos'
type ModalState = { type: 'song' | 'user'; item?: Cancion | Usuario } | null
const pageSize = 10

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), 300); return () => clearTimeout(timer) }, [value])
  return debounced
}

function ErrorState({ retry }: { retry: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><AlertCircle /></span><h3>No pudimos cargar esta lista</h3><p>Comprueba la conexión e inténtalo de nuevo.</p><button className="button button-secondary" onClick={retry}>Reintentar</button></div>
}
function SkeletonRows() { return <div className="skeleton-list" aria-label="Cargando"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div> }
function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Music2 /></span><h3>{title}</h3><p>{text}</p>{action}</div> }
function Modal({ state, close, onSaved }: { state: ModalState; close: () => void; onSaved: (section: 'song' | 'user', editing: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const qc = useQueryClient()
  useEffect(() => {
    if (!state) return
    const item = state.item as Cancion | Usuario | undefined
    setValues(state.type === 'song' ? {
      titulo: (item as Cancion)?.titulo ?? '', artista: (item as Cancion)?.artista ?? '', album: (item as Cancion)?.album ?? '', duracion: String((item as Cancion)?.duracion ?? ''), año: String((item as Cancion)?.año ?? new Date().getFullYear()), genero: (item as Cancion)?.genero ?? '',
    } : { nombre: (item as Usuario)?.nombre ?? '', correo: (item as Usuario)?.correo ?? '' })
    setErrors({})
  }, [state])
  if (!state) return null
  const song = state.type === 'song'
  const editing = Boolean(state.item)
  const validate = (key: string, value: string) => {
    let error = ''
    if (key !== 'album' && !value.trim()) error = 'Este campo es obligatorio.'
    if (key === 'nombre' && value.length > 100) error = 'Máximo 100 caracteres.'
    if (['titulo', 'artista'].includes(key) && value.length > 200) error = 'Máximo 200 caracteres.'
    if (key === 'genero' && value.length > 100) error = 'Máximo 100 caracteres.'
    if (key === 'album' && value.length > 200) error = 'Máximo 200 caracteres.'
    if (key === 'correo' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Escribe un correo válido.'
    if (key === 'duracion' && (!/^\d+$/.test(value) || Number(value) <= 0)) error = 'Usa un entero mayor que 0.'
    if (key === 'año' && (!/^\d+$/.test(value) || Number(value) < 1900 || Number(value) > new Date().getFullYear())) error = `Entre 1900 y ${new Date().getFullYear()}.`
    return error
  }
  const update = (key: string, value: string) => { setValues(v => ({ ...v, [key]: value })); setErrors(e => ({ ...e, [key]: validate(key, value) })) }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, validate(k, v)]).filter(([, v]) => v))
    if (!values.correo && !song) nextErrors.correo = 'Este campo es obligatorio.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setBusy(true)
    try {
      if (song) {
        const payload: CancionInput = { titulo: values.titulo.trim(), artista: values.artista.trim(), album: values.album.trim() || null, duracion: Number(values.duracion), año: Number(values.año), genero: values.genero.trim() }
        if (editing) await api.updateSong((state.item as Cancion).id, payload); else await api.createSong(payload)
        await qc.invalidateQueries({ queryKey: ['songs'] }); await qc.invalidateQueries({ queryKey: ['favorites'] })
      } else {
        const payload: UsuarioInput = { nombre: values.nombre.trim(), correo: values.correo.trim().toLowerCase() }
        if (editing) await api.updateUser((state.item as Usuario).id, payload); else await api.createUser(payload)
        await qc.invalidateQueries({ queryKey: ['users'] })
      }
      toast.success(`${song ? 'Canción' : 'Usuario'} ${editing ? 'actualizado' : 'creado'}`)
      onSaved(state.type, editing); close()
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && Array.isArray(error.detail)) {
        const mapped: Record<string, string> = {}
        for (const issue of error.detail as Array<{ loc?: (string | number)[]; msg?: string }>) mapped[String(issue.loc?.at(-1) ?? '')] = issue.msg ?? 'Valor inválido.'
        setErrors(mapped)
      } else if (error instanceof ApiError && error.status === 409) setErrors({ correo: error.message })
      else toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar. Comprueba la conexión.')
    } finally { setBusy(false) }
  }
  const fields = song ? [
    ['titulo', 'Título', 'text'], ['artista', 'Artista', 'text'], ['album', 'Álbum', 'text'], ['duracion', 'Duración (segundos)', 'number'], ['año', 'Año', 'number'], ['genero', 'Género', 'text'],
  ] : [['nombre', 'Nombre', 'text'], ['correo', 'Correo electrónico', 'email']]
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><div><p className="eyebrow">{editing ? 'ACTUALIZAR' : 'AÑADIR A TU COLECCIÓN'}</p><h2 id="modal-title">{editing ? 'Editar' : 'Nueva'} {song ? 'canción' : 'usuario'}</h2></div><button className="icon-button" onClick={close} aria-label="Cerrar"><X /></button></header><form onSubmit={submit} noValidate><div className="form-grid">{fields.map(([key, label, type]) => <label key={key} className={`field ${song && key === 'album' ? 'field-wide' : ''}`}><span>{label}{key !== 'album' && <i> *</i>}</span><input type={type} min={type === 'number' ? 1 : undefined} value={values[key] ?? ''} onChange={e => update(key, e.target.value)} aria-invalid={Boolean(errors[key])} maxLength={key === 'nombre' || key === 'genero' ? 100 : key === 'album' || key === 'titulo' || key === 'artista' ? 200 : undefined} autoComplete={key === 'correo' ? 'email' : 'off'} /><small>{errors[key] || ' '}</small></label>)}</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={close} disabled={busy}>Cancelar</button><button className="button button-dark" disabled={busy}>{busy && <LoaderCircle className="spin" />} {editing ? 'Guardar cambios' : song ? 'Crear canción' : 'Crear usuario'}</button></div></form></section></div>
}

export default function Page() {
  const qc = useQueryClient()
  const [section, setSection] = useState<Section>('canciones')
  const [activeUser, setActiveUser] = useState(1)
  const [userLoaded, setUserLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const term = useDebounced(search)
  const [page, setPage] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [dark, setDark] = useState(false)
  const [demoNotice, setDemoNotice] = useState(false)
  useEffect(() => { const value = Number(localStorage.getItem('active-music-user')); if (value) setActiveUser(value); setUserLoaded(true); setDark(localStorage.getItem('music-theme') === 'dark') }, [])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('music-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { if (userLoaded) localStorage.setItem('active-music-user', String(activeUser)) }, [activeUser, userLoaded])
  useEffect(() => { const timer = setInterval(() => setDemoNotice(isDemoMode()), 350); return () => clearInterval(timer) }, [])
  const usersQuery = useQuery({ queryKey: ['users', 0], queryFn: ({ signal }) => api.users(0, 500, signal), retry: 1 })
  const songsQuery = useQuery({ queryKey: ['songs', page, term], queryFn: ({ signal }) => api.songs(page * pageSize, pageSize, term, signal), placeholderData: previous => previous, retry: 1 })
  const favoritesQuery = useQuery({ queryKey: ['favorites', activeUser], queryFn: ({ signal }) => api.favorites(activeUser, signal), enabled: userLoaded && activeUser > 0, retry: 1 })
  const allSongsQuery = useQuery({ queryKey: ['allSongs'], queryFn: ({ signal }) => api.songs(0, 500, '', signal), enabled: section === 'favoritos', retry: 1 })
  const songs = songsQuery.data ?? []
  const users = usersQuery.data ?? []
  const favorites = favoritesQuery.data ?? []
  const favoriteSongs = useMemo(() => favorites.map(f => ({ favorite: f, song: songsQuery.data ? undefined : undefined })), [favorites, songsQuery.data])
  const toggleFavorite = useMutation({ mutationFn: async ({ songId, adding }: { songId: number; adding: boolean }) => adding ? api.addFavorite(activeUser, songId) : api.removeFavorite(activeUser, songId), onMutate: async ({ songId, adding }) => { await qc.cancelQueries({ queryKey: ['favorites', activeUser] }); const key = ['favorites', activeUser]; const previous = qc.getQueryData<typeof favorites>(key) ?? []; qc.setQueryData(key, adding ? [...previous, { id: -songId, id_usuario: activeUser, id_cancion: songId, fecha_marcado: new Date().toISOString() }] : previous.filter(f => f.id_cancion !== songId)); return { previous } }, onError: (_e, _v, context) => { if (context) qc.setQueryData(['favorites', activeUser], context.previous); toast.error(_e instanceof ApiError ? _e.message : 'No se pudo actualizar el favorito.') }, onSuccess: (_data, vars) => toast.success(vars.adding ? 'Favorito agregado' : 'Favorito eliminado'), onSettled: () => qc.invalidateQueries({ queryKey: ['favorites', activeUser] }) })
  const removeUser = async (user: Usuario) => { if (!window.confirm(`¿Eliminar a ${user.nombre}? Esta acción no se puede deshacer.`)) return; try { await api.deleteUser(user.id); toast.success('Usuario eliminado'); if (activeUser === user.id && users.length > 1) setActiveUser(users.find(u => u.id !== user.id)!.id); await qc.invalidateQueries({ queryKey: ['users'] }); await qc.invalidateQueries({ queryKey: ['favorites'] }) } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el usuario.') } }
  const removeSong = async (song: Cancion) => { if (!window.confirm(`¿Eliminar “${song.titulo}”?`)) return; try { await api.deleteSong(song.id); toast.success('Canción eliminada'); await qc.invalidateQueries({ queryKey: ['songs'] }); await qc.invalidateQueries({ queryKey: ['favorites'] }) } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la canción.') } }
  const active = users.find(u => u.id === activeUser)
  const retry = useCallback(() => { if (section === 'canciones') void songsQuery.refetch(); else if (section === 'usuarios') void usersQuery.refetch(); else void favoritesQuery.refetch() }, [section, songsQuery, usersQuery, favoritesQuery])
  const menu: { id: Section; label: string; icon: typeof Music2 }[] = [{ id: 'canciones', label: 'Canciones', icon: ListMusic }, { id: 'favoritos', label: 'Favoritos', icon: Heart }, { id: 'usuarios', label: 'Usuarios', icon: Users }]
  return <main className="app-shell"><Toaster position="top-right" richColors closeButton /><aside className="sidebar"><a className="brand" href="#inicio"><span className="brand-mark"><Disc3 /></span><span>surco<span className="brand-dot">.</span><small>MÚSICA, A TU MANERA</small></span></a><p className="nav-label">BIBLIOTECA</p><nav className="side-nav" aria-label="Secciones principales">{menu.map(item => <button key={item.id} onClick={() => { setSection(item.id); setPage(0) }} className={`nav-item ${section === item.id ? 'selected' : ''}`} aria-current={section === item.id ? 'page' : undefined}><item.icon /><span>{item.label}</span>{item.id === 'canciones' && <span className="nav-count">{songsQuery.data?.length ?? '—'}</span>}</button>)}</nav><div className="sidebar-spacer" /><div className="sidebar-note"><span className="note-icon"><Headphones /></span><p>Tu música,<br /><strong>en un solo lugar.</strong></p></div><div className="sidebar-profile"><span className="avatar">{active?.nombre?.slice(0, 1) ?? 'M'}</span><span className="profile-text"><strong>{active?.nombre ?? 'Elige un usuario'}</strong><small>Oyente activo</small></span><button className="icon-button profile-more" aria-label="Más opciones"><MoreHorizontal /></button></div></aside>
    <section className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Tu espacio</span><span className="crumb-separator">/</span><strong>{menu.find(m => m.id === section)?.label}</strong></div><div className="top-actions"><label className="active-user"><span>OYENTE</span><select aria-label="Usuario activo" value={activeUser} onChange={e => setActiveUser(Number(e.target.value))}>{users.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></label><button className="icon-button theme-toggle" onClick={() => setDark(x => !x)} aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>{dark ? <Sun /> : <Moon />}</button><span className="top-avatar">{active?.nombre?.slice(0, 1) ?? 'M'}</span></div></header>
      <div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">TU COLECCIÓN PERSONAL</p><h1>{section === 'canciones' ? 'Canciones' : section === 'favoritos' ? 'Tus favoritos' : 'Usuarios'}</h1><p className="page-subtitle">{section === 'canciones' ? 'Explora y organiza la banda sonora de tu vida.' : section === 'favoritos' ? `Lo mejor de tu biblioteca, ${active?.nombre?.split(' ')[0] ?? 'para ti'}.` : 'Gestiona quién escucha en este espacio.'}</p></div>{section !== 'favoritos' && <button className="button button-dark add-button" onClick={() => setModal({ type: section === 'canciones' ? 'song' : 'user' })}><Plus />{section === 'canciones' ? 'Nueva canción' : 'Nuevo usuario'}</button>}</div>
        {demoNotice && <div className="demo-banner" role="status"><Sparkles /><span>Vista de demostración · La API no está disponible. Los cambios se guardan en memoria.</span><button onClick={() => setDemoNotice(false)} aria-label="Cerrar aviso"><X /></button></div>}
        {section === 'canciones' && <><div className="stats-strip"><div className="stat-cell"><span className="stat-icon lime"><Music2 /></span><div><small>EN TU BIBLIOTECA</small><strong>{songsQuery.data?.length ?? '—'} <i>canciones</i></strong></div></div><div className="stat-cell"><span className="stat-icon lilac"><Heart /></span><div><small>TUS FAVORITAS</small><strong>{favorites.length} <i>guardadas</i></strong></div></div><div className="stat-cell"><span className="stat-icon peach"><Activity /></span><div><small>ESCUCHANDO</small><strong>Siempre <i>que quieras</i></strong></div></div><div className="stat-decoration"><span>♪</span><span>♫</span><span>♬</span></div></div><div className="list-toolbar"><div className="list-title"><h2>Tu biblioteca</h2><span className="count-pill">{songsQuery.data?.length ?? 0}</span></div><label className="search-box"><Search /><span className="sr-only">Buscar canciones</span><input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Buscar título, artista o género..." /><kbd>⌘ K</kbd></label></div>{songsQuery.isError ? <ErrorState retry={retry} /> : songsQuery.isPending ? <SkeletonRows /> : songs.length === 0 ? <EmptyState title="Aún no hay canciones" text="Prueba otra búsqueda o añade tu primera canción." action={<button className="button button-dark" onClick={() => setModal({ type: 'song' })}><Plus />Añadir canción</button>} /> : <><div className="table-wrap"><table><thead><tr><th className="track-col">TÍTULO</th><th>ÁLBUM</th><th>GÉNERO</th><th>AÑO</th><th>DURACIÓN</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{songs.map((song, i) => { const liked = favorites.some(f => f.id_cancion === song.id); return <tr key={song.id}><td><div className="track-cell"><span className={`track-cover cover-${i % 6}`}><Disc3 /></span><span><strong>{song.titulo}</strong><small>{song.artista}</small></span></div></td><td className="muted-cell">{song.album || '—'}</td><td><span className="genre-chip">{song.genero}</span></td><td className="muted-cell">{song.año}</td><td className="muted-cell time-cell">{Math.floor(song.duracion / 60)}:{String(song.duracion % 60).padStart(2, '0')}</td><td><div className="row-actions"><button className={`icon-button heart-action ${liked ? 'liked' : ''}`} aria-label={liked ? 'Quitar de favoritos' : 'Añadir a favoritos'} onClick={() => toggleFavorite.mutate({ songId: song.id, adding: !liked })}><Heart fill={liked ? 'currentColor' : 'none'} /></button><button className="icon-button" aria-label={`Editar ${song.titulo}`} onClick={() => setModal({ type: 'song', item: song })}><Pencil /></button><button className="icon-button delete-action" aria-label={`Eliminar ${song.titulo}`} onClick={() => void removeSong(song)}><Trash2 /></button></div></td></tr> })}</tbody></table></div><div className="mobile-cards">{songs.map((song, i) => { const liked = favorites.some(f => f.id_cancion === song.id); return <article className="song-card" key={song.id}><span className={`track-cover cover-${i % 6}`}><Disc3 /></span><div className="song-card-main"><strong>{song.titulo}</strong><small>{song.artista}</small><span>{song.genero} · {song.año} · {Math.floor(song.duracion / 60)}:{String(song.duracion % 60).padStart(2, '0')}</span></div><div className="row-actions"><button className={`icon-button heart-action ${liked ? 'liked' : ''}`} aria-label="Cambiar favorito" onClick={() => toggleFavorite.mutate({ songId: song.id, adding: !liked })}><Heart fill={liked ? 'currentColor' : 'none'} /></button><button className="icon-button" aria-label={`Editar ${song.titulo}`} onClick={() => setModal({ type: 'song', item: song })}><Pencil /></button></div></article> })}</div><Pagination page={page} count={songs.length} next={() => setPage(p => p + 1)} previous={() => setPage(p => Math.max(0, p - 1))} loading={songsQuery.isFetching} /></>}</>}
        {section === 'usuarios' && (usersQuery.isError ? <ErrorState retry={retry} /> : usersQuery.isPending ? <SkeletonRows /> : users.length === 0 ? <EmptyState title="No hay usuarios todavía" text="Añade a las personas que comparten esta biblioteca." action={<button className="button button-dark" onClick={() => setModal({ type: 'user' })}><Plus />Nuevo usuario</button>} /> : <div className="users-panel"><div className="list-toolbar"><div className="list-title"><h2>Personas</h2><span className="count-pill">{users.length}</span></div></div><div className="table-wrap"><table><thead><tr><th>USUARIO</th><th>CORREO</th><th>FECHA DE REGISTRO</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{users.map((user, i) => <tr key={user.id}><td><div className="track-cell"><span className={`avatar user-avatar avatar-${i % 4}`}>{user.nombre.slice(0, 1)}</span><span><strong>{user.nombre}</strong><small>{user.id === activeUser ? 'Oyente activo' : 'Oyente'}</small></span></div></td><td className="muted-cell">{user.correo}</td><td className="muted-cell">{new Date(user.fecha_registro).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Editar ${user.nombre}`} onClick={() => setModal({ type: 'user', item: user })}><Pencil /></button><button className="icon-button delete-action" aria-label={`Eliminar ${user.nombre}`} onClick={() => void removeUser(user)}><Trash2 /></button></div></td></tr>)}</tbody></table></div></div>)}
        {section === 'favoritos' && (favoritesQuery.isError ? <ErrorState retry={retry} /> : favoritesQuery.isPending || allSongsQuery.isPending ? <SkeletonRows /> : favorites.length === 0 ? <EmptyState title="Tu lista está esperando" text="Marca el corazón de una canción para guardarla aquí." action={<button className="button button-dark" onClick={() => setSection('canciones')}>Explorar canciones</button>} /> : <><div className="favorite-intro"><span className="favorite-big"><Heart fill="currentColor" /></span><div><span className="eyebrow">UNA COLECCIÓN MUY TUYA</span><h2>{favorites.length} {favorites.length === 1 ? 'canción guardada' : 'canciones guardadas'}</h2><p>Una selección para volver a escuchar.</p></div></div><div className="favorite-grid">{favorites.map((favorite, i) => { const song = allSongsQuery.data?.find(s => s.id === favorite.id_cancion); if (!song) return null; return <article className="favorite-card" key={favorite.id}><div className={`favorite-art art-${i % 6}`}><Disc3 /><span>{String(i + 1).padStart(2, '0')}</span></div><div className="favorite-card-info"><span className="eyebrow">{song.genero} · {song.año}</span><h3>{song.titulo}</h3><p>{song.artista}</p><button className="icon-button liked" aria-label={`Quitar ${song.titulo} de favoritos`} onClick={() => toggleFavorite.mutate({ songId: song.id, adding: false })}><Heart fill="currentColor" /></button></div></article> })}</div></>)}
      </div><footer className="footer-note"><span><span className="online-dot" />Tu espacio musical</span><span>Hecho para escuchar con calma</span></footer></section>
    <nav className="mobile-nav" aria-label="Navegación inferior">{menu.map(item => <button key={item.id} onClick={() => { setSection(item.id); setPage(0) }} className={section === item.id ? 'active' : ''}><item.icon /><span>{item.label}</span></button>)}</nav><Modal state={modal} close={() => setModal(null)} onSaved={() => {}} /></main>
}
function Pagination({ page, count, previous, next, loading }: { page: number; count: number; previous: () => void; next: () => void; loading: boolean }) { return <div className="pagination"><span>{loading ? 'Actualizando…' : `Mostrando ${count ? page * pageSize + 1 : 0}–${page * pageSize + count} canciones`}</span><div><button className="button button-secondary page-button" disabled={page === 0 || loading} onClick={previous}><ChevronLeft />Anterior</button><button className="button button-secondary page-button" disabled={count < pageSize || loading} onClick={next}>Siguiente<ChevronRight /></button></div></div> }
