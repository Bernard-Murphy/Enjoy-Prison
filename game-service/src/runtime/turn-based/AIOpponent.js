var AIOpponent = {
  getGridMove: function (
    board,
    rows,
    cols,
    player,
    opponent,
    difficulty,
    gridConfig,
  ) {
    if (difficulty === "easy") {
      return this._gridRandomMove(board, rows, cols, gridConfig);
    }
    if (difficulty === "medium") {
      if (Math.random() < 0.5) {
        return this._gridSmartMove(
          board,
          rows,
          cols,
          player,
          opponent,
          gridConfig,
        );
      }
      return this._gridRandomMove(board, rows, cols, gridConfig);
    }
    return this._gridSmartMove(board, rows, cols, player, opponent, gridConfig);
  },

  _gridRandomMove: function (board, rows, cols, gridConfig) {
    var emptyCells = [];
    var placement = (gridConfig && gridConfig.placement) || "any-empty";
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (board[r][c] === null) {
          if (placement === "gravity-bottom") {
            if (r === rows - 1 || board[r + 1][c] !== null) {
              emptyCells.push({ row: r, col: c });
            }
          } else {
            emptyCells.push({ row: r, col: c });
          }
        }
      }
    }
    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  },

  _gridSmartMove: function (board, rows, cols, player, opponent, gridConfig) {
    var winCond = (gridConfig && gridConfig.winCondition) || {};
    var winCount = winCond.count || 3;
    if ((gridConfig && gridConfig.placement) === "gravity-bottom") {
      return this._minimaxGrid(
        board,
        rows,
        cols,
        player,
        opponent,
        winCount,
        gridConfig,
        4,
      );
    }
    var totalCells = rows * cols;
    var depth = totalCells <= 9 ? 9 : totalCells <= 16 ? 4 : 3;
    return this._minimaxGrid(
      board,
      rows,
      cols,
      player,
      opponent,
      winCount,
      gridConfig,
      depth,
    );
  },

  _getValidGridMoves: function (board, rows, cols, gridConfig) {
    var moves = [];
    var placement = (gridConfig && gridConfig.placement) || "any-empty";
    if (placement === "gravity-bottom") {
      for (var c = 0; c < cols; c++) {
        for (var r = rows - 1; r >= 0; r--) {
          if (board[r][c] === null) {
            moves.push({ row: r, col: c });
            break;
          }
        }
      }
    } else {
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (board[r][c] === null) {
            moves.push({ row: r, col: c });
          }
        }
      }
    }
    return moves;
  },

  _checkGridWin: function (
    board,
    rows,
    cols,
    row,
    col,
    symbol,
    winCount,
    gridConfig,
  ) {
    var winCond = (gridConfig && gridConfig.winCondition) || {};
    var directions = winCond.directions || [
      "horizontal",
      "vertical",
      "diagonal-down",
      "diagonal-up",
    ];
    var deltas = {
      horizontal: { dr: 0, dc: 1 },
      vertical: { dr: 1, dc: 0 },
      "diagonal-down": { dr: 1, dc: 1 },
      "diagonal-up": { dr: -1, dc: 1 },
    };
    for (var d = 0; d < directions.length; d++) {
      var delta = deltas[directions[d]];
      if (!delta) continue;
      var count = 1;
      var r = row + delta.dr;
      var c = col + delta.dc;
      while (
        r >= 0 &&
        r < rows &&
        c >= 0 &&
        c < cols &&
        board[r][c] === symbol
      ) {
        count++;
        r += delta.dr;
        c += delta.dc;
      }
      r = row - delta.dr;
      c = col - delta.dc;
      while (
        r >= 0 &&
        r < rows &&
        c >= 0 &&
        c < cols &&
        board[r][c] === symbol
      ) {
        count++;
        r -= delta.dr;
        c -= delta.dc;
      }
      if (count >= winCount) return true;
    }
    return false;
  },

  _minimaxGrid: function (
    board,
    rows,
    cols,
    player,
    opponent,
    winCount,
    gridConfig,
    maxDepth,
  ) {
    var validMoves = this._getValidGridMoves(board, rows, cols, gridConfig);
    if (validMoves.length === 0) return null;

    for (var i = 0; i < validMoves.length; i++) {
      var move = validMoves[i];
      board[move.row][move.col] = player.symbol;
      if (
        this._checkGridWin(
          board,
          rows,
          cols,
          move.row,
          move.col,
          player.symbol,
          winCount,
          gridConfig,
        )
      ) {
        board[move.row][move.col] = null;
        return move;
      }
      board[move.row][move.col] = null;
    }

    for (var i = 0; i < validMoves.length; i++) {
      var move = validMoves[i];
      board[move.row][move.col] = opponent.symbol;
      if (
        this._checkGridWin(
          board,
          rows,
          cols,
          move.row,
          move.col,
          opponent.symbol,
          winCount,
          gridConfig,
        )
      ) {
        board[move.row][move.col] = null;
        return move;
      }
      board[move.row][move.col] = null;
    }

    var bestMove = validMoves[0];
    var bestScore = -Infinity;
    for (var i = 0; i < validMoves.length; i++) {
      var move = validMoves[i];
      board[move.row][move.col] = player.symbol;
      var score = this._minimaxScore(
        board,
        rows,
        cols,
        player,
        opponent,
        winCount,
        gridConfig,
        maxDepth - 1,
        false,
        -Infinity,
        Infinity,
      );
      board[move.row][move.col] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  },

  _minimaxScore: function (
    board,
    rows,
    cols,
    player,
    opponent,
    winCount,
    gridConfig,
    depth,
    isMaximizing,
    alpha,
    beta,
  ) {
    var validMoves = this._getValidGridMoves(board, rows, cols, gridConfig);

    for (var i = 0; i < validMoves.length; i++) {
      var m = validMoves[i];
      board[m.row][m.col] = player.symbol;
      if (
        this._checkGridWin(
          board,
          rows,
          cols,
          m.row,
          m.col,
          player.symbol,
          winCount,
          gridConfig,
        )
      ) {
        board[m.row][m.col] = null;
        return 1000;
      }
      board[m.row][m.col] = null;
    }
    for (var i = 0; i < validMoves.length; i++) {
      var m = validMoves[i];
      board[m.row][m.col] = opponent.symbol;
      if (
        this._checkGridWin(
          board,
          rows,
          cols,
          m.row,
          m.col,
          opponent.symbol,
          winCount,
          gridConfig,
        )
      ) {
        board[m.row][m.col] = null;
        return -1000;
      }
      board[m.row][m.col] = null;
    }

    if (validMoves.length === 0 || depth <= 0) {
      return this._gridHeuristic(board, rows, cols, player, opponent, winCount);
    }

    if (isMaximizing) {
      var maxScore = -Infinity;
      for (var i = 0; i < validMoves.length; i++) {
        var move = validMoves[i];
        board[move.row][move.col] = player.symbol;
        var score = this._minimaxScore(
          board,
          rows,
          cols,
          player,
          opponent,
          winCount,
          gridConfig,
          depth - 1,
          false,
          alpha,
          beta,
        );
        board[move.row][move.col] = null;
        if (score > maxScore) maxScore = score;
        if (score > alpha) alpha = score;
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      var minScore = Infinity;
      for (var i = 0; i < validMoves.length; i++) {
        var move = validMoves[i];
        board[move.row][move.col] = opponent.symbol;
        var score = this._minimaxScore(
          board,
          rows,
          cols,
          player,
          opponent,
          winCount,
          gridConfig,
          depth - 1,
          true,
          alpha,
          beta,
        );
        board[move.row][move.col] = null;
        if (score < minScore) minScore = score;
        if (score < beta) beta = score;
        if (beta <= alpha) break;
      }
      return minScore;
    }
  },

  _gridHeuristic: function (board, rows, cols, player, opponent, winCount) {
    var score = 0;
    var dirs = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 },
      { dr: -1, dc: 1 },
    ];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        for (var d = 0; d < dirs.length; d++) {
          var delta = dirs[d];
          var pCount = 0;
          var oCount = 0;
          var empty = 0;
          for (var k = 0; k < winCount; k++) {
            var nr = r + delta.dr * k;
            var nc = c + delta.dc * k;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
            if (board[nr][nc] === player.symbol) pCount++;
            else if (board[nr][nc] === opponent.symbol) oCount++;
            else empty++;
          }
          if (pCount + oCount + empty === winCount) {
            if (oCount === 0 && pCount > 0) score += pCount * pCount;
            if (pCount === 0 && oCount > 0) score -= oCount * oCount;
          }
        }
      }
    }
    return score;
  },

  getMemoryMove: function (
    knownCards,
    flippedCards,
    rows,
    cols,
    cardsPerTurn,
    difficulty,
  ) {
    var picks = [];
    var maxMem = difficulty === "easy" ? 0 : difficulty === "medium" ? 6 : 999;
    var seen = {};
    for (var key in knownCards) {
      if (knownCards.hasOwnProperty(key)) seen[key] = knownCards[key];
    }
    var flippedSet = {};
    for (var key in flippedCards) {
      if (flippedCards.hasOwnProperty(key)) flippedSet[key] = true;
    }
    var values = [];
    for (var k in seen) {
      if (seen.hasOwnProperty(k) && !flippedSet[k]) values.push(seen[k]);
    }
    var countByValue = {};
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      countByValue[v] = (countByValue[v] || 0) + 1;
    }
    for (var v in countByValue) {
      if (countByValue[v] >= 2) {
        var found = 0;
        for (var r = 0; r < rows && found < 2; r++) {
          for (var c = 0; c < cols && found < 2; c++) {
            var key = r + "," + c;
            if (!flippedSet[key] && seen[key] === v) {
              picks.push({ row: r, col: c });
              found++;
            }
          }
        }
        if (picks.length >= cardsPerTurn) return picks;
      }
    }
    var unknowns = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var key = r + "," + c;
        if (!flippedSet[key]) unknowns.push({ row: r, col: c });
      }
    }
    for (var i = 0; i < unknowns.length && picks.length < cardsPerTurn; i++) {
      var j = Math.floor(Math.random() * (unknowns.length - i)) + i;
      var tmp = unknowns[i];
      unknowns[i] = unknowns[j];
      unknowns[j] = tmp;
      picks.push(unknowns[i]);
    }
    return picks.slice(0, cardsPerTurn);
  },

  getBoardGameDecision: function (
    gameState,
    player,
    decisionType,
    options,
    difficulty,
  ) {
    if (!options || options.length === 0) return null;
    if (difficulty === "easy") {
      return options[Math.floor(Math.random() * options.length)];
    }
    if (decisionType === "buy-property") {
      var money = (player.data && player.data.money) || 0;
      var cost = (options[0] && options[0].cost) || 0;
      if (difficulty === "hard" && money > cost * 1.5) return options[0];
      if (difficulty === "medium" && money > cost * 1.2) return options[0];
      if (Math.random() < 0.5) return options[0];
      return null;
    }
    if (decisionType === "pay-rent" || decisionType === "trade") {
      return options[Math.floor(Math.random() * options.length)];
    }
    return options[Math.floor(Math.random() * options.length)];
  },

  getCardGameMove: function (hand, gameState, cardConfig, difficulty) {
    if (!hand || hand.length === 0) return "draw";
    var subType = (cardConfig && cardConfig.subType) || "matching";
    var topDiscard = (gameState && gameState.topDiscard) || null;
    if (subType === "shedding" && topDiscard) {
      var matchBy = (cardConfig && cardConfig.matchBy) || "suit-or-value";
      var playable = [];
      for (var i = 0; i < hand.length; i++) {
        var card = hand[i];
        var match =
          matchBy === "suit"
            ? card.suit === topDiscard.suit
            : matchBy === "value"
              ? card.value === topDiscard.value
              : matchBy === "color"
                ? card.color === topDiscard.color
                : card.suit === topDiscard.suit ||
                  card.value === topDiscard.value;
        if (
          match ||
          card.special === "wild" ||
          card.special === "wild-draw-four"
        ) {
          playable.push({ card: card, index: i });
        }
      }
      if (playable.length > 0) {
        if (difficulty === "easy") {
          return playable[Math.floor(Math.random() * playable.length)].card;
        }
        var specials = playable.filter(function (p) {
          return (
            p.card.special === "skip" ||
            p.card.special === "reverse" ||
            p.card.special === "draw-two"
          );
        });
        var pick =
          specials.length > 0 && difficulty === "hard"
            ? specials[Math.floor(Math.random() * specials.length)]
            : playable[Math.floor(Math.random() * playable.length)];
        return pick.card;
      }
      if ((cardConfig && cardConfig.canDrawFromPile) !== false) return "draw";
      return null;
    }
    if (subType === "matching" || subType === "war") {
      return hand[Math.floor(Math.random() * hand.length)];
    }
    if (subType === "blackjack") {
      var total = (gameState && gameState.handTotal) || 0;
      if (total < 16 && difficulty !== "easy") return "hit";
      if (total >= 17) return "stand";
      return Math.random() < 0.5 ? "hit" : "stand";
    }
    return hand[Math.floor(Math.random() * hand.length)];
  },

  getTriviaAnswer: function (question, difficulty) {
    var correctChance =
      difficulty === "easy" ? 0.3 : difficulty === "hard" ? 0.9 : 0.6;
    if (Math.random() < correctChance) {
      return question.correctIndex;
    }
    var wrongIndices = [];
    for (var i = 0; i < question.answers.length; i++) {
      if (i !== question.correctIndex) wrongIndices.push(i);
    }
    return wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
  },

  getLetterGuess: function (guessedLetters, difficulty) {
    var frequency = "etaoinsrhldcumwfgypbvkjxqz";
    if (difficulty === "easy") {
      var available = [];
      for (var i = 0; i < 26; i++) {
        var letter = String.fromCharCode(97 + i);
        if (guessedLetters.indexOf(letter) === -1) available.push(letter);
      }
      if (available.length === 0) return null;
      return available[Math.floor(Math.random() * available.length)];
    }
    for (var i = 0; i < frequency.length; i++) {
      if (guessedLetters.indexOf(frequency[i]) === -1) {
        return frequency[i];
      }
    }
    return null;
  },
};
