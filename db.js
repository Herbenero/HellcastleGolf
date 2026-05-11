// IndexedDB Database Manager for Hellcastle Golf Game History
class GolfDatabase {
  constructor(dbName = 'HellcastleGolfDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  // Initialize database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Database failed to open:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create Games object store
        if (!db.objectStoreNames.contains('games')) {
          const gameStore = db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
          gameStore.createIndex('date', 'date', { unique: false });
          gameStore.createIndex('courseLength', 'courseLength', { unique: false });
          gameStore.createIndex('timestamp', 'timestamp', { unique: true });
        }

        // Create Players object store
        if (!db.objectStoreNames.contains('players')) {
          const playerStore = db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
          playerStore.createIndex('gameId', 'gameId', { unique: false });
          playerStore.createIndex('name', 'name', { unique: false });
        }

        console.log('Database initialized successfully');
      };
    });
  }

  // Save a completed game
  async saveGame(gameData) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['games', 'players'], 'readwrite');
      const gameStore = transaction.objectStore('games');
      const playerStore = transaction.objectStore('players');

      const game = {
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(),
        courseLength: gameData.totalHoles,
        playerCount: gameData.players.length,
        scores: gameData.players.map(p => ({ name: p.name, total: p.total, scores: p.scores })),
        winner: gameData.winner,
        duration: gameData.duration || null
      };

      const gameRequest = gameStore.add(game);

      gameRequest.onsuccess = () => {
        const gameId = gameRequest.result;
        
        // Save individual player records
        gameData.players.forEach(player => {
          const playerRecord = {
            gameId: gameId,
            name: player.name,
            total: player.total,
            scores: player.scores,
            courseLength: gameData.totalHoles
          };
          playerStore.add(playerRecord);
        });

        resolve(gameId);
      };

      gameRequest.onerror = () => {
        reject(gameRequest.error);
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  // Get all games
  async getAllGames() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['games'], 'readonly');
      const store = transaction.objectStore('games');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result.reverse()); // Most recent first
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get games by date range
  async getGamesByDateRange(startDate, endDate) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['games'], 'readonly');
      const store = transaction.objectStore('games');
      const index = store.index('date');
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);

      request.onsuccess = () => {
        resolve(request.result.reverse());
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get games by course length
  async getGamesByCourseLength(courseLength) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['games'], 'readonly');
      const store = transaction.objectStore('games');
      const index = store.index('courseLength');
      const request = index.getAll(courseLength);

      request.onsuccess = () => {
        resolve(request.result.reverse());
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get a specific game by ID
  async getGameById(gameId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['games'], 'readonly');
      const store = transaction.objectStore('games');
      const request = store.get(gameId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get player statistics
  async getPlayerStats(playerName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['players'], 'readonly');
      const store = transaction.objectStore('players');
      const index = store.index('name');
      const request = index.getAll(playerName);

      request.onsuccess = () => {
        const records = request.result;
        if (records.length === 0) {
          resolve(null);
          return;
        }

        const stats = {
          name: playerName,
          gamesPlayed: records.length,
          totalScore: 0,
          bestScore: Infinity,
          worstScore: -Infinity,
          averageScore: 0,
          by3Holes: { games: 0, scores: [] },
          by9Holes: { games: 0, scores: [] }
        };

        records.forEach(record => {
          stats.totalScore += record.total;
          stats.bestScore = Math.min(stats.bestScore, record.total);
          stats.worstScore = Math.max(stats.worstScore, record.total);

          if (record.courseLength === 3) {
            stats.by3Holes.games++;
            stats.by3Holes.scores.push(record.total);
          } else if (record.courseLength === 9) {
            stats.by9Holes.games++;
            stats.by9Holes.scores.push(record.total);
          }
        });

        stats.averageScore = Math.round(stats.totalScore / records.length);
        resolve(stats);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get all player names
  async getAllPlayerNames() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['players'], 'readonly');
      const store = transaction.objectStore('players');
      const request = store.getAll();

      request.onsuccess = () => {
        const names = [...new Set(request.result.map(p => p.name))];
        resolve(names.sort());
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Delete a game
  async deleteGame(gameId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['games', 'players'], 'readwrite');
      const gameStore = transaction.objectStore('games');
      const playerStore = transaction.objectStore('players');
      const playerIndex = playerStore.index('gameId');

      // Delete the game
      gameStore.delete(gameId);

      // Delete associated player records
      const playerRequest = playerIndex.getAll(gameId);
      playerRequest.onsuccess = () => {
        playerRequest.result.forEach(player => {
          playerStore.delete(player.id);
        });
      };

      transaction.oncomplete = () => {
        resolve(true);
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  // Clear all data
  async clearAllData() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['games', 'players'], 'readwrite');
      transaction.objectStore('games').clear();
      transaction.objectStore('players').clear();

      transaction.oncomplete = () => {
        console.log('All data cleared');
        resolve(true);
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  // Export games as JSON
  async exportGamesAsJSON() {
    const games = await this.getAllGames();
    const dataStr = JSON.stringify(games, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hellcastle_golf_history_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Get statistics summary
  async getStatisticsSummary() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['games'], 'readonly');
      const store = transaction.objectStore('games');
      const request = store.getAll();

      request.onsuccess = () => {
        const games = request.result;
        const summary = {
          totalGames: games.length,
          totalPlayers: 0,
          gamesBy3Holes: games.filter(g => g.courseLength === 3).length,
          gamesBy9Holes: games.filter(g => g.courseLength === 9).length,
          bestScore: games.length > 0 ? Math.min(...games.map(g => Math.min(...g.scores.map(s => s.total)))) : 0,
          worstScore: games.length > 0 ? Math.max(...games.map(g => Math.max(...g.scores.map(s => s.total)))) : 0,
          uniquePlayers: new Set(games.flatMap(g => g.scores.map(s => s.name))).size
        };
        resolve(summary);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Initialize the database
const golfDB = new GolfDatabase();
golfDB.init().catch(err => console.error('Failed to initialize database:', err));
