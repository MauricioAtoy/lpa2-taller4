export type Usuario = { id: number; nombre: string; correo: string; fecha_registro: string }
export type Cancion = { id: number; titulo: string; artista: string; album: string | null; duracion: number; año: number; genero: string; fecha_creacion: string }
export type Favorito = { id: number; id_usuario: number; id_cancion: number; fecha_marcado: string }
export type CancionInput = Omit<Cancion, 'id' | 'fecha_creacion'>
export type UsuarioInput = Pick<Usuario, 'nombre' | 'correo'>

const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
let demo = false
let users: Usuario[] = [
  { id: 1, nombre: 'Ana Torres', correo: 'ana.torres@example.com', fecha_registro: '2026-11-17T10:00:00Z' },
  { id: 2, nombre: 'Carlos Gómez', correo: 'carlos.gomez@example.com', fecha_registro: '2026-11-17T10:00:00Z' },
  { id: 3, nombre: 'Lucía Méndez', correo: 'lucia.mendez@example.com', fecha_registro: '2026-11-16T09:20:00Z' },
]
let songs: Cancion[] = [
  { id: 1, titulo: 'Bohemian Rhapsody', artista: 'Queen', album: 'A Night at the Opera', duracion: 354, año: 1975, genero: 'Rock', fecha_creacion: '2026-11-17T10:00:00Z' },
  { id: 2, titulo: 'Billie Jean', artista: 'Michael Jackson', album: 'Thriller', duracion: 294, año: 1982, genero: 'Pop', fecha_creacion: '2026-11-17T10:00:00Z' },
  { id: 3, titulo: 'Dreams', artista: 'Fleetwood Mac', album: 'Rumours', duracion: 257, año: 1977, genero: 'Rock', fecha_creacion: '2026-11-16T10:00:00Z' },
  { id: 4, titulo: 'Bésame Mucho', artista: 'Consuelo Velázquez', album: 'Lo mejor de México', duracion: 186, año: 1940, genero: 'Bolero', fecha_creacion: '2026-11-15T10:00:00Z' },
  { id: 5, titulo: 'Ojitos Lindos', artista: 'Bad Bunny, Bomba Estéreo', album: 'Un Verano Sin Ti', duracion: 258, año: 2022, genero: 'Urbano', fecha_creacion: '2026-11-14T10:00:00Z' },
  { id: 6, titulo: 'Hips Don’t Lie', artista: 'Shakira', album: 'Oral Fixation, Vol. 2', duracion: 218, año: 2006, genero: 'Pop', fecha_creacion: '2026-11-13T10:00:00Z' },
  { id: 7, titulo: 'Hasta la Raíz', artista: 'Natalia Lafourcade', album: 'Hasta la Raíz', duracion: 215, año: 2015, genero: 'Indie', fecha_creacion: '2026-11-12T10:00:00Z' },
  { id: 8, titulo: 'La Flaca', artista: 'Jarabe de Palo', album: 'La Flaca', duracion: 240, año: 1996, genero: 'Rock latino', fecha_creacion: '2026-11-11T10:00:00Z' },
  { id: 9, titulo: 'So What', artista: 'Miles Davis', album: 'Kind of Blue', duracion: 562, año: 1959, genero: 'Jazz', fecha_creacion: '2026-11-10T10:00:00Z' },
  { id: 10, titulo: 'Eres', artista: 'Café Tacvba', album: 'Cuatro Caminos', duracion: 256, año: 2003, genero: 'Alternativo', fecha_creacion: '2026-11-09T10:00:00Z' },
  { id: 11, titulo: 'Waka Waka', artista: 'Shakira', album: 'Sale el Sol', duracion: 202, año: 2010, genero: 'Pop', fecha_creacion: '2026-11-08T10:00:00Z' },
]
let favorites: Favorito[] = [
  { id: 1, id_usuario: 1, id_cancion: 1, fecha_marcado: '2026-11-17T10:00:00Z' },
  { id: 2, id_usuario: 1, id_cancion: 4, fecha_marcado: '2026-11-17T10:00:00Z' },
  { id: 3, id_usuario: 2, id_cancion: 2, fecha_marcado: '2026-11-17T10:00:00Z' },
]

export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, detail: unknown) {
    const raw = typeof detail === 'string' ? detail : 'Error al comunicarse con el servicio.'
    super(status === 404 ? `${raw || 'Elemento'} no encontrado` : raw)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (demo) throw new TypeError('demo')
  let response: Response
  try { response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, signal: init?.signal }) }
  catch { demo = true; throw new TypeError('demo') }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: unknown }
    throw new ApiError(response.status, body.detail ?? 'No se pudo completar la solicitud.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
const query = (skip: number, limit: number, extra = '') => `?skip=${skip}&limit=${limit}${extra}`
const now = () => new Date().toISOString()
export const isDemoMode = () => demo
export const api = {
  users: async (skip: number, limit: number, signal?: AbortSignal) => { try { return await request<Usuario[]>(`/api/usuarios${query(skip, limit)}`, { signal }) } catch (e) { if (!(e instanceof TypeError)) throw e; return users.slice(skip, skip + limit) } },
  songs: async (skip: number, limit: number, search: string, signal?: AbortSignal) => { try { if (!search) return await request<Cancion[]>(`/api/canciones${query(skip, limit)}`, { signal }); const params = (field: string) => `?${new URLSearchParams({ [field]: search, skip: '0', limit: '500' })}`; const results = await Promise.all(['titulo', 'artista', 'genero'].map(field => request<Cancion[]>(`/api/canciones/buscar${params(field)}`, { signal }))); const unique = [...new Map(results.flat().map(song => [song.id, song])).values()]; return unique.slice(skip, skip + limit) } catch (e) { if (!(e instanceof TypeError) || (e as Error).name === 'AbortError') throw e; const filtered = songs.filter(s => `${s.titulo} ${s.artista} ${s.genero}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())); return filtered.slice(skip, skip + limit) } },
  favorites: async (userId: number, signal?: AbortSignal) => { try { return await request<Favorito[]>(`/api/usuarios/${userId}/favoritos?skip=0&limit=500`, { signal }) } catch (e) { if (!(e instanceof TypeError)) throw e; return favorites.filter(f => f.id_usuario === userId) } },
  createUser: async (input: UsuarioInput) => { try { return await request<Usuario>('/api/usuarios', { method: 'POST', body: JSON.stringify({ ...input, correo: input.correo.toLowerCase() }) }) } catch (e) { if (!(e instanceof TypeError)) throw e; const row = { ...input, correo: input.correo.toLowerCase(), id: Math.max(0, ...users.map(x => x.id)) + 1, fecha_registro: now() }; users = [row, ...users]; return row } },
  updateUser: async (id: number, input: UsuarioInput) => { try { return await request<Usuario>(`/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify({ ...input, correo: input.correo.toLowerCase() }) }) } catch (e) { if (!(e instanceof TypeError)) throw e; users = users.map(u => u.id === id ? { ...u, ...input, correo: input.correo.toLowerCase() } : u); return users.find(u => u.id === id)! } },
  deleteUser: async (id: number) => { try { await request<void>(`/api/usuarios/${id}`, { method: 'DELETE' }) } catch (e) { if (!(e instanceof TypeError)) throw e; users = users.filter(u => u.id !== id); favorites = favorites.filter(f => f.id_usuario !== id) } },
  createSong: async (input: CancionInput) => { try { return await request<Cancion>('/api/canciones', { method: 'POST', body: JSON.stringify(input) }) } catch (e) { if (!(e instanceof TypeError)) throw e; const row = { ...input, id: Math.max(0, ...songs.map(x => x.id)) + 1, fecha_creacion: now() }; songs = [row, ...songs]; return row } },
  updateSong: async (id: number, input: CancionInput) => { try { return await request<Cancion>(`/api/canciones/${id}`, { method: 'PUT', body: JSON.stringify(input) }) } catch (e) { if (!(e instanceof TypeError)) throw e; songs = songs.map(s => s.id === id ? { ...s, ...input } : s); return songs.find(s => s.id === id)! } },
  deleteSong: async (id: number) => { try { await request<void>(`/api/canciones/${id}`, { method: 'DELETE' }) } catch (e) { if (!(e instanceof TypeError)) throw e; songs = songs.filter(s => s.id !== id); favorites = favorites.filter(f => f.id_cancion !== id) } },
  addFavorite: async (userId: number, songId: number) => { try { return await request<Favorito>(`/api/usuarios/${userId}/favoritos/${songId}`, { method: 'POST' }) } catch (e) { if (!(e instanceof TypeError)) throw e; const row = { id: Math.max(0, ...favorites.map(x => x.id)) + 1, id_usuario: userId, id_cancion: songId, fecha_marcado: now() }; favorites = [...favorites, row]; return row } },
  removeFavorite: async (userId: number, songId: number) => { try { await request<void>(`/api/usuarios/${userId}/favoritos/${songId}`, { method: 'DELETE' }) } catch (e) { if (!(e instanceof TypeError)) throw e; favorites = favorites.filter(f => !(f.id_usuario === userId && f.id_cancion === songId)) } },
}
