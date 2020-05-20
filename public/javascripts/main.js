Vue.component('signin', {
    template: `
        <div class="login-form">
            <form @submit="signin">
                <label>
                    <input type="text" v-model="handle" placeholder="Username" required="">
                </label>
                <label>
                    <input type="password" v-model="password" placeholder="Password" required="">
                </label>
                <input type="submit">
            </form>
        </div>
    `,

    data() {
        return {
            handle: undefined,
            password: undefined
        }
    },

    methods: {
        signin(form) {
            form.preventDefault();
            fetch(`/user/signin`,
                {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({handle: this.handle, password: this.password})
                })
                .then(async (response) => {
                    if(response.status !== 200) {
                        throw await response.text();
                    }
                    window.location = '/views/lobby.html'
                })
                .catch(function (e) {
                    window.alert(e);
                })
        }
    }

});

new Vue({
    el: '#app',
});
