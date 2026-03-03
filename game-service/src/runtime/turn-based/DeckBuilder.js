var DeckBuilder = {
  buildStandardDeck: function (deckCount, includeJokers) {
    var suits = ["hearts", "diamonds", "clubs", "spades"];
    var values = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
    ];
    var suitColors = {
      hearts: "#cc3333",
      diamonds: "#cc3333",
      clubs: "#333333",
      spades: "#333333",
    };
    var suitSymbols = {
      hearts: "\u2665",
      diamonds: "\u2666",
      clubs: "\u2663",
      spades: "\u2660",
    };

    var deck = [];
    var count = deckCount || 1;
    for (var d = 0; d < count; d++) {
      for (var s = 0; s < suits.length; s++) {
        var suit = suits[s];
        for (var v = 0; v < values.length; v++) {
          var val = values[v];
          deck.push({
            suit: suit,
            value: val,
            displayName: val + suitSymbols[suit],
            color: suitColors[suit],
            points: v + 1,
            id: suit + "_" + val + "_" + d,
          });
        }
      }
      if (includeJokers) {
        deck.push({
          suit: "wild",
          value: "Joker",
          displayName: "\uD83C\uDCBF",
          color: "#9933cc",
          points: 0,
          id: "joker_1_" + d,
        });
        deck.push({
          suit: "wild",
          value: "Joker",
          displayName: "\uD83C\uDCBF",
          color: "#9933cc",
          points: 0,
          id: "joker_2_" + d,
        });
      }
    }
    return deck;
  },

  buildCustomDeck: function (customCards) {
    var deck = [];
    for (var i = 0; i < customCards.length; i++) {
      var card = customCards[i];
      deck.push({
        suit: card.suit || "custom",
        value: card.value,
        displayName: card.displayName || card.value,
        color: card.color || "#ffffff",
        points: card.points || 0,
        special: card.special || "none",
        id: "custom_" + i,
      });
    }
    return deck;
  },

  shuffle: function (deck) {
    var arr = deck.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  },

  deal: function (deck, playerCount, cardsPerPlayer) {
    var hands = [];
    for (var p = 0; p < playerCount; p++) {
      hands.push([]);
    }
    for (var c = 0; c < cardsPerPlayer; c++) {
      for (var p = 0; p < playerCount; p++) {
        if (deck.length > 0) {
          hands[p].push(deck.pop());
        }
      }
    }
    return { hands: hands, remaining: deck };
  },
};
