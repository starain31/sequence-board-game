const users = {
    sakib: {
        name: "Sakib ibne kamal",
        password: '123'
    },
    jabir: {
        name: 'Jabir ibne kamal',
        password: '1'
    }
};

async function get_user({handle}) {
    return users[handle];
}

module.exports = {get_user};
