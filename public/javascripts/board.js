Vue.component('board', {
    template: `
        <div class="board">
            <div v-for="row in deck" class="board-row">
                <board-cell v-for="card in row" :card="card"></board-cell>
            </div>
        </div>`,

    data() {
        return {
            deck: [
                [
                    {
                        name: 'Blank'
                    },
                    {
                        name: '6-Diamond'
                    },
                    {
                        name: '7-Diamond'
                    },
                    {
                        name: '8-Diamond'
                    },
                    {
                        name: '9-Diamond'
                    },
                    {
                        name: '10-Diamond'
                    },
                    {
                        name: 'Q-Diamond'
                    },
                    {
                        name: 'K-Diamond'
                    },
                    {
                        name: 'A-Diamond'
                    },
                    {
                        name: 'Blank'
                    },
                ],
                [
                    {
                        name: '5-Diamond'
                    },
                    {
                        name: '3-Heart'
                    },
                    {
                        name: '2-Heart'
                    },
                    {
                        name: '2-Spade'
                    },
                    {
                        name: '3-Spade'
                    },
                    {
                        name: '4-Spade'
                    },
                    {
                        name: '5-Spade'
                    },
                    {
                        name: '6-Spade'
                    },
                    {
                        name: '7-Spade'
                    },
                    {
                        name: 'A-Club'
                    }
                ],
                [
                    {
                        name: '4-Diamond'
                    },
                    {
                        name: '4-Heart'
                    },
                    {
                        name: 'K-Diamond'
                    },
                    {
                        name: 'A-Diamond'
                    },
                    {
                        name: 'A-Club'
                    },
                    {
                        name: 'K-Club'
                    },
                    {
                        name: 'Q-Club'
                    },
                    {
                        name: '10-Club'
                    },
                    {
                        name: '8-Spade'
                    },
                    {
                        name: 'K-Club'
                    },
                ],
                [
                    {
                        name: '3-Diamond'
                    },
                    {
                        name: '5-Heart'
                    },
                    {
                        name: 'Q-Diamond'
                    },
                    {
                        name: 'Q-Heart'
                    },
                    {
                        name: '10-Heart'
                    },
                    {
                        name: '9-Heart'
                    },
                    {
                        name: '8-Heart'
                    },
                    {
                        name: '9-Club'
                    },
                    {
                        name: '9-Spade'
                    },
                    {
                        name: 'Q-Club'
                    },
                ],
                [
                    {
                        name: '2-Diamond'
                    },
                    {
                        name: '6-Heart'
                    },
                    {
                        name: '10-Diamond'
                    },
                    {
                        name: 'K-Heart'
                    },
                    {
                        name: '3-Heart'
                    },
                    {
                        name: '2-Heart'
                    },
                    {
                        name: '7-Heart'
                    },
                    {
                        name: '8-Club'
                    },
                    {
                        name: '10-Spade'
                    },
                    {
                        name: '10-Club'
                    },
                ],
                [
                    {
                        name: 'A-Spade'
                    },
                    {
                        name: '7-Heart'
                    },
                    {
                        name: '9-Diamond'
                    },
                    {
                        name: 'A-Heart'
                    },
                    {
                        name: '4-Heart'
                    },
                    {
                        name: '5-Heart'
                    },
                    {
                        name: '6-Heart'
                    },
                    {
                        name: '7-Club'
                    },
                    {
                        name: 'Q-Spade'
                    },
                    {
                        name: '9-Club'
                    },
                ],
                [
                    {
                        name: 'K-Spade'
                    },
                    {
                        name: '8-Heart'
                    },
                    {
                        name: '8-Diamond'
                    },
                    {
                        name: '2-Club'
                    },
                    {
                        name: '3-Club'
                    },
                    {
                        name: '4-Club'
                    },
                    {
                        name: '5-Club'
                    },
                    {
                        name: '6-Club'
                    },
                    {
                        name: 'K-Spade'
                    },
                    {
                        name: '8-Club'
                    },
                ],
                [
                    {
                        name: 'Q-Spade'
                    },
                    {
                        name: '9-Heart'
                    },
                    {
                        name: '7-Diamond'
                    },
                    {
                        name: '6-Diamond'
                    },
                    {
                        name: '5-Diamond'
                    },
                    {
                        name: '4-Diamond'
                    },
                    {
                        name: '3-Diamond'
                    },
                    {
                        name: '2-Diamond'
                    },
                    {
                        name: 'A-Spade'
                    },
                    {
                        name: '7-Club'
                    },
                ],
                [
                    {
                        name: '10-Spade'
                    },
                    {
                        name: '10-Heart'
                    },
                    {
                        name: 'Q-Heart'
                    },
                    {
                        name: 'K-Heart'
                    },
                    {
                        name: 'A-Heart'
                    },
                    {
                        name: '2-Club'
                    },
                    {
                        name: '3-Club'
                    },
                    {
                        name: '4-Club'
                    },
                    {
                        name: '5-Club'
                    },
                    {
                        name: '6-Club'
                    },
                ],
                [
                    {
                        name: 'Blank'
                    },
                    {
                        name: '9-Spade'
                    },
                    {
                        name: '8-Spade'
                    },
                    {
                        name: '7-Spade'
                    },
                    {
                        name: '6-Spade'
                    },
                    {
                        name: '5-Spade'
                    },
                    {
                        name: '4-Spade'
                    },
                    {
                        name: '3-Spade'
                    },
                    {
                        name: '2-Spade'
                    },
                    {
                        name: 'Blank'
                    },
                ],
            ],
        }
    },

    methods: {
        play_card(card_name) {
            const selected_card = controller.$data.selected_card;
            if (is_valid_move(selected_card, card_name)) {

            } else {
                console.log(`Invalid Move`);
            }
        }
    },
});

Vue.component('board-cell', {
    template: `
        <div class="board-cell" @click="play_card(card.name)">
            <img :src="'./images/card_deck/Cards-' + card.name + '.svg'" height="100%" :alt="card.name">
        </div>`,

    props: {
        card: {
            type: String,
            require: true,
        }
    },
});

Vue.component('controller', {
    template: `
        <div class="controller">
            <h1>Board Controller</h1>
            <button @click="shuffle" class="shuffle_button">Shuffle</button>
            <hand :cards="cards_in_hand"></hand>
        </div>`,

    data() {
        return {
            deck: [
                {name: '6-Diamond'},
                {name: '7-Diamond'},
                {name: '8-Diamond'},
                {name: '9-Diamond'},
                {name: '10-Diamond'},
                {name: 'Q-Diamond'},
                {name: 'K-Diamond'},
                {name: 'A-Diamond'},
                {name: '5-Diamond'},
                {name: '3-Heart'},
                {name: '2-Heart'},
                {name: '2-Spade'},
                {name: '3-Spade'},
                {name: '4-Spade'},
                {name: '5-Spade'},
                {name: '6-Spade'},
                {name: '7-Spade'},
                {name: 'A-Club'},
                {name: '4-Diamond'},
                {name: '4-Heart'},
                {name: 'K-Diamond'},
                {name: 'A-Diamond'},
                {name: 'A-Club'},
                {name: 'K-Club'},
                {name: 'Q-Club'},
                {name: '10-Club'},
                {name: '8-Spade'},
                {name: 'K-Club'},
                {name: '3-Diamond'},
                {name: '5-Heart'},
                {name: 'Q-Diamond'},
                {name: 'Q-Heart'},
                {name: '10-Heart'},
                {name: '9-Heart'},
                {name: '8-Heart'},
                {name: '9-Club'},
                {name: '9-Spade'},
                {name: 'Q-Club'},
                {name: '2-Diamond'},
                {name: '6-Heart'},
                {name: '10-Diamond'},
                {name: 'K-Heart'},
                {name: '3-Heart'},
                {name: '2-Heart'},
                {name: '7-Heart'},
                {name: '8-Club'},
                {name: '10-Spade'},
                {name: '10-Club'},
                {name: 'A-Spade'},
                {name: '7-Heart'},
                {name: '9-Diamond'},
                {name: 'A-Heart'},
                {name: '4-Heart'},
                {name: '5-Heart'},
                {name: '6-Heart'},
                {name: '7-Club'},
                {name: 'Q-Spade'},
                {name: '9-Club'},
                {name: 'K-Spade'},
                {name: '8-Heart'},
                {name: '8-Diamond'},
                {name: '2-Club'},
                {name: '3-Club'},
                {name: '4-Club'},
                {name: '5-Club'},
                {name: '6-Club'},
                {name: 'K-Spade'},
                {name: '8-Club'},
                {name: 'Q-Spade'},
                {name: '9-Heart'},
                {name: '7-Diamond'},
                {name: '6-Diamond'},
                {name: '5-Diamond'},
                {name: '4-Diamond'},
                {name: '3-Diamond'},
                {name: '2-Diamond'},
                {name: 'A-Spade'},
                {name: '7-Club'},
                {name: '10-Spade'},
                {name: '10-Heart'},
                {name: 'Q-Heart'},
                {name: 'K-Heart'},
                {name: 'A-Heart'},
                {name: '2-Club'},
                {name: '3-Club'},
                {name: '4-Club'},
                {name: '5-Club'},
                {name: '6-Club'},
                {name: '9-Spade'},
                {name: '8-Spade'},
                {name: '7-Spade'},
                {name: '6-Spade'},
                {name: '5-Spade'},
                {name: '4-Spade'},
                {name: '3-Spade'},
                {name: '2-Spade'},
                {name: 'J-Spade'},
                {name: 'J-Spade'},
                {name: 'J-Heart'},
                {name: 'J-Heart'},
                {name: 'J-Club'},
                {name: 'J-Club'},
                {name: 'J-Diamond'},
                {name: 'J-Diamond'}
            ],
            cards_in_hand: undefined,
            selected_card: undefined,
        }
    },

    methods: {
        shuffle: function () {
            this.cards_in_hand = get_cards({deck: this.deck, number_of_cards: 7});
        },
        select_card: function (card_name) {
            this.selected_card = card_name;
        }
    },
});

Vue.component('hand', {
    template: `
        <div>
           <finger v-for="card in cards" :card="card"></finger>
        </div>`,

     props: {
        cards: {
            type: Array,
            require: true,
        }
     }
});

Vue.component('finger', {
    template: `
         <div class="board-cell" style="float: left" @click="select_card(card.name)">
            <img :src="'./images/card_deck/Cards-' + card.name + '.svg'" height="100%" :alt="card.name">
         </div>`,

    props: {
        card: {
            type: String,
            required: true
        }
    }
});

const app = new Vue({
    el: '#app',
});

function get_cards({deck, number_of_cards}) {
    const cards_in_hand = [];
    for (let i = 0; i < number_of_cards; i++) {
        const random_card = Math.floor(Math.random() * deck.length);
        cards_in_hand.push(deck[random_card]);
        deck.splice(random_card, 1);
    }
    return cards_in_hand;
}

function get_option(card_name) {
    if (card_name === 'J-Diamond' || card_name === 'J-Club') {

    } else if (card_name === 'J-Spade' || card_name === 'J-Heart') {

    } else {

    }
}

function is_valid_move(selected_card, card_name) {
    return selected_card === card_name;
}