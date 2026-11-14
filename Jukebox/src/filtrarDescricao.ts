import EIC from '../EIC.json'
// ---------- Tipos de entrada (os mesmos da versão anterior) ----------
export interface Imagem {
  id: number; url: string; filename: string; media_type: string
  alt_text: string; width: number; height: number; pixels: number
}
export type ExtraData = Record<string, never>

export interface PageInstance {
  id: number; url: string; page_type: string; title: string
  description: string; release_date: string; update_date: string
  main_image: Imagem
}

interface ItemBase { id: number; extra_data: null; title?: string; caption?: string }
export type Item =
  | (ItemBase & { type: 'gallery_page' | 'details_page'; instance: PageInstance })
  | (ItemBase & { type: 'media_group'; instance: Imagem })

export interface MediaGroup {
  id: number; url: string; widget: string; title: string
  caption: string; description: string; items: Item[]; extra_data: ExtraData
}

export interface Root {
  id: number; url: string; page_type: string; title: string
  description: string; release_date: string; update_date: string
  main_image: Imagem; media_groups: MediaGroup[]
}

// ---------- Tipos de saída ----------
export type Origem =
  | 'root'
  | 'media_group'
  | 'item'
  | 'page_instance'
  | 'imagem'

export interface Entrada<T = string> {
  id: number
  origem: Origem
  valor: T
}

export interface PorTipo {
  descricao: Entrada[]
  titulo: Entrada[]
  legenda: Entrada[]
  url: Entrada[]
  altText: Entrada[]
  tipoPagina: Entrada[]
  tipoItem: Entrada[]
  widget: Entrada[]
  arquivo: Entrada[]
  tipoMidia: Entrada[]
  dataLancamento: Entrada[]
  dataAtualizacao: Entrada[]
  dimensoes: Entrada<{ width: number; height: number; pixels: number }>[]
}

// ---------- Função ----------
export function extrairPorTipo(
  root: Root,
  { ignorarVazios = true }: { ignorarVazios?: boolean } = {}
): PorTipo {
  const saida: PorTipo = {
    descricao: [], titulo: [], legenda: [], url: [], altText: [],
    tipoPagina: [], tipoItem: [], widget: [], arquivo: [], tipoMidia: [],
    dataLancamento: [], dataAtualizacao: [], dimensoes: [],
  }

  // Evita duplicar o mesmo campo do mesmo objeto (imagens/páginas se repetem)
  const visto = new Set<string>()

  function add<K extends keyof PorTipo>(
    campo: K,
    origem: Origem,
    id: number,
    valor: PorTipo[K][number]['valor'] | undefined
  ): void {
    if (valor === undefined || valor === null) return
    if (ignorarVazios && typeof valor === 'string' && valor.trim() === '') return

    const chave = `${campo}:${origem}:${id}`
    if (visto.has(chave)) return
    visto.add(chave)

    ;(saida[campo] as Entrada<typeof valor>[]).push({ id, origem, valor })
  }

  function lerImagem(img: Imagem): void {
    add('url', 'imagem', img.id, img.url)
    add('arquivo', 'imagem', img.id, img.filename)
    add('tipoMidia', 'imagem', img.id, img.media_type)
    add('altText', 'imagem', img.id, img.alt_text)
    add('dimensoes', 'imagem', img.id, {
      width: img.width, height: img.height, pixels: img.pixels,
    })
  }

  function lerPagina(p: Root | PageInstance, origem: 'root' | 'page_instance'): void {
    add('url', origem, p.id, p.url)
    add('tipoPagina', origem, p.id, p.page_type)
    add('titulo', origem, p.id, p.title)
    add('descricao', origem, p.id, p.description)
    add('dataLancamento', origem, p.id, p.release_date)
    add('dataAtualizacao', origem, p.id, p.update_date)
    lerImagem(p.main_image)
  }

  lerPagina(root, 'root')

  for (const grupo of root.media_groups) {
    add('url', 'media_group', grupo.id, grupo.url)
    add('widget', 'media_group', grupo.id, grupo.widget)
    add('titulo', 'media_group', grupo.id, grupo.title)
    add('legenda', 'media_group', grupo.id, grupo.caption)
    add('descricao', 'media_group', grupo.id, grupo.description)

    for (const item of grupo.items) {
      add('tipoItem', 'item', item.id, item.type)
      add('titulo', 'item', item.id, item.title)
      add('legenda', 'item', item.id, item.caption)

      if (item.type === 'media_group') lerImagem(item.instance)
      else lerPagina(item.instance, 'page_instance')
    }
  }

  return saida
}

const {descricao, titulo, url, tipoMidia} = extrairPorTipo(EIC as Root);
export { descricao, titulo, url, tipoMidia };