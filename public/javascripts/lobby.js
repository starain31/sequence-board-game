Vue.component('lobby', {
    template: `
        <div class="lobby">
            <form @submit.prevent="create_room">
                <input type="number" v-model="number_of_team" placeholder="Number of Team" required="">
                <input type="number" v-model="number_of_player_in_each_team" placeholder="Number of Players"
                       required="">
                <input type="submit" value="Create Room">
            </form>
            <form @submit.prevent="join_room">
                <input type="text" v-model="room_id_input" placeholder="Room ID" required="">
                <input type="submit" value="Join Room">
            </form>
            <room v-if="room_id !== undefined" :id="room_id"></room>
        </div>`,

    data() {
        return {
            room_id_input: undefined,
            profile_info: {name: undefined},
            room_id: undefined,
            number_of_team: undefined,
            number_of_player_in_each_team: undefined
        }
    },

    methods: {
        create_room() {
            fetch('/room/create',
                {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        number_of_team: this.number_of_team,
                        number_of_player_in_each_team: this.number_of_player_in_each_team
                    })
                })
                .then((response) => {
                    return response.json();
                })
                .then((room) => {
                    this.room_id = room.id;
                });
        },

        join_room() {
            this.room_id = this.room_id_input;

        }
    },

    mounted() {
        // fetch(`/profile?administrator=${this.profile_info}`)
        //     .then((response) => {
        //         return response.json();
        //     })
        //     .then((profile_info) => {
        //         this.profile_info = profile_info;
        //     });
    }

});

Vue.component('room', {
    template: `
        <div>
            Room ID: {{id}} Administrator: {{room.administrator}}
            <table>
                <tr v-for="team in teams">
                    <th>{{team.handle}}</th>
                    <td v-for="player in team.players">{{ player ? player.name : 'Empty'}}</td>
                    <td>
                        <button @click="join_team({team_handle: team.handle})">Join {{team.handle}}</button>
                    </td>
                </tr>
            </table>
            <div>
                <button @click="start_game">Start Game</button>
            </div>
        </div>`,

    data() {
        return {
            room: undefined,
            teams: undefined
        }

    },

    methods: {
        join_team({team_handle}) {
            fetch(`/room/${this.id}/join`,
                {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({team_handle})
                })
                .then((response) => {
                    return response.json();
                })
                .then((data) => {
                    console.log(data);
                });
        },

        start_game() {
            fetch(`/room/${this.id}/start`,
                {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                })
                .then((response) => {
                    console.log({response});
                    return response.json();
                })
                .then((data) => {
                    console.log({data});
                });

            const socket = io();
            socket.on('game_initialized', () => {
                window.location = '/index.html';
            })
        }
    },

    mounted() {
        fetch(`/room/${this.id}`)
            .then(async (response) => {
                if (response.status === 404) {
                    const error = await response.json();
                    window.alert(JSON.stringify(error));
                } else {
                    const room = await response.json();
                    this.room = room;
                    this.teams = room.teams;
                }
            });

        const socket = io();
        socket.on('room_updated', (room) => {
            this.teams = room.teams;
        });
    },

    props: {
        id: {
            type: String,
            required: true
        }
    },
});
