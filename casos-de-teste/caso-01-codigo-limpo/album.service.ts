export interface Album {
  readonly id: string;
  readonly totalCards: number;
}

export interface AlbumRepository {
  findById(id: string): Promise<Album | undefined>;
  countOwnedCards(albumId: string, userId: string): Promise<number>;
}

export class AlbumNotFoundError extends Error {
  constructor(albumId: string) {
    super(`Álbum ${albumId} não encontrado`);
  }
}

const FULL_PERCENTAGE = 100;

export class AlbumProgressService {
  constructor(private readonly albums: AlbumRepository) {}

  async progressOf(albumId: string, userId: string): Promise<number> {
    const album = await this.albums.findById(albumId);
    if (!album) throw new AlbumNotFoundError(albumId);
    if (album.totalCards === 0) return 0;

    const owned = await this.albums.countOwnedCards(albumId, userId);
    return Math.round((owned / album.totalCards) * FULL_PERCENTAGE);
  }
}
