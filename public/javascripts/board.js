const player_handler = 'jabir';

Vue.component('board', {
    template: `
        <div class="board">
            <div v-for="(row, index_of_row) in deck" class="board-row">
                <div v-for="(card, index_of_column) in row">
                    <board-cell
                            :card="card"
                            :option="option"
                            :index_of_row="index_of_row"
                            :index_of_column="index_of_column"
                            @play_card="play_card"
                            @update_board="update_board"
                            :class="{
                                occupied_by_team1: card.occupied_by === 'TEAM_1',
                                occupied_by_team2: card.occupied_by === 'TEAM_2',
                                occupied_by_team3: card.occupied_by === 'TEAM_3',
                                selected_card: (card.name === option && card.occupied_by === undefined)
                            }"
                    ></board-cell>
                </div>
            </div>
        </div>`,

    data() {
        return {
            deck: [],
            option: undefined,
            selected_card_index: undefined
        }
    },

    methods: {
        update_board() {
            fetch(`/board/deck`)
                .then((response) => {
                    return response.json();
                })
                .then((data) => {
                    this.deck = data.deck;
                });
        },

        play_card(board_card_index) {
            fetch(`/game/play?board_card_index=${JSON.stringify(board_card_index)}&hand_card_index=${this.selected_card_index}`)
                .then(async (response) => {
                    if(response.status !== 200) {
                        throw await response.text();
                    }
                    return response.json();
                })
                .then((data) => {
                    //TO-DO
                    //baje coding
                    event_bus.$emit('hand_card_updated', data.cards);
                })
                .catch((e) => {
                    alert(e);
                });
        }
    },

    mounted() {
        event_bus.$on('highlight_options_on_board', (selected_card_name, selected_card_index) => {
            this.option = selected_card_name;
            this.selected_card_index = selected_card_index;
        });

        fetch(`/board/deck`)
            .then((response) => {
                return response.json();
            })
            .then((data) => {
                this.deck = data.deck;
            })
            .catch(function (e) {
                console.error(e);
            });

        const socket = io();
        socket.on('board_updated', (data) => {
            this.deck = data;
            this.option = undefined;
            this.selected_card_index = undefined;
        });
    }
});

Vue.component('board-cell', {
    template: `
        <div class="board-cell" @click="play_card(card)">
            <img :src="'./images/card_deck/Cards-' + card.name + '.svg'"
                 height="100%"
                 :alt="card.name"
            >
        </div>`,

    methods: {
        play_card() {
            this.$emit('play_card', {
                row: this.index_of_row,
                column: this.index_of_column
            });
            this.$emit('update_board');
        }
    },

    props: {
        card: {
            type: Object,
            require: true,
        },
        option: {
            type: String,
            required: false
        },
        index_of_row: {
            type: Number,
            required: false
        },
        index_of_column: {
            type: Number,
            required: false
        },
    },
});

Vue.component('controller', {
    template: `
        <div class="controller">
            <h1>Board Controller</h1>
            <hand :cards="cards_in_hand"></hand>
        </div>`,

    data() {
        return {
            cards_in_hand: []
        }
    },

    mounted() {
        fetch(`/game/hand_cards`)
            .then((response) => {
                return response.json();
            })
            .then((data) => {
                this.cards_in_hand = data.cards_in_hand;
            });

        event_bus.$on('hand_card_updated', (cards) => {
            this.cards_in_hand = cards;
        });
    }
});

Vue.component('hand', {
    template: `
        <div>
            <div v-for="(card, index) in cards">
                <finger
                        :card="card" :index="index"
                        :class="{selected_card: card === selected_card}"
                        @update_selected_card="update_selected_card"
                ></finger>
            </div>
        </div>`,

    data() {
        return {
            selected_card: undefined,
        }
    },

    methods: {
        update_selected_card(card, index) {
            this.selected_card = card;
            this.selected_card_index = index;
            event_bus.$emit('highlight_options_on_board', this.selected_card.name, this.selected_card_index);
        }
    },

    props: {
        cards: {
            type: Array,
            require: true,
        }
    }
});

Vue.component('finger', {
    template: `
        <div class="board-cell" style="float: left"
             @click="select_card"
        >
            <img :src="'./images/card_deck/Cards-' + card.name + '.svg'" height="100%" :alt="card.name">
        </div>`,

    methods: {
        select_card() {
            this.$emit(`update_selected_card`, this.card, this.index);
        }
    },

    props: {
        card: {
            type: Object,
            required: true
        },
        index: {
            type: Number,
            required: true
        }
    }
});

const event_bus = new Vue();

new Vue({
    el: '#app',
    data: {
        player_handler: 'jabir',
    }
});
