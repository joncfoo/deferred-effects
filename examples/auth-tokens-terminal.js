const {
    program,
    Instruction,
    UIAction,
    Result,
    Token,
} = require('./auth-tokens-program')

const Future = require('fluture')
const readline = require('readline')

const ReadLine = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

// close the underlying stream else the program never terminates as it always
// waits for data on stdin.
ReadLine.on('close', () => process.stdin.destroy())


// Our "data store"
function Store(tokens) {
    this.tokens = tokens
}

Store.prototype.fetchTokens = function() {
    return Future.of(Result.Ok(this.tokens))
}

Store.prototype.createToken = function(tokenName) {
    if (tokenName.length < 8) {
        return Future.of(Result.Error('Token name must be 8 or more characters'))
    }

    // generate a new ID: max value + 1
    const newID = this.tokens.map(t => t.id).reduce((i2, i) => i > i2 ? i : i2, 0) + 1
    const newName = '****' + tokenName.substr(tokenName.length - 4, 4)
    const token = Token(newID, newName)
    this.tokens.push(token)

    // simulate work
    return Future.after(1000, Result.Ok(token))
}

Store.removeToken = function(tokenID) {
    const i = DataStore.tokens.findIndex(t => t.id === tokenID)
    if (i < 0) {
        return Future.of(Result.Error(`Invalid token ID: ${tokenID}`))
    } else {
        this.tokens = this.tokens.filter(t => t.id !== tokenId)
        return Future.of(Result.Ok({}))
    }
}


const DataStore = new Store([
    Token(1, '****abcd'),
    Token(2, '****efgh'),
    Token(3, '****ijkl'),
    Token(4, '****mnop'),
])


const effectsInterpreter = {
    Return: (value) =>
        Future.of(value),

    NotifyError: (error) =>
        Future.reject(error),

    ListTokens: () =>
        DataStore.fetchTokens(),

    DeleteToken: (tokenID) =>
        DataStore.removeToken(tokenID),

    CreateToken: (tokenName) =>
        DataStore.createToken(tokenName),

    AwaitUIAction: () => {
        return new Future((reject, resolve) => {
            const prompt = `
What would you like to do?
S: show all tokens
C: create a token
D: delete a token
Q: quit
action #> `
            const resolveOk = value => resolve(Result.Ok(value))
            const resolveError = err => resolve(Result.Error(err))

            ReadLine.question(prompt, input => {
                switch (input.toLowerCase()) {
                case 's':
                    resolveOk(UIAction.Show)
                    break
                case 'c':
                    resolveOk(UIAction.Create)
                    break
                case 'd':
                    ReadLine.question('Which token id? #> ', id => {
                        if (Number.isNaN(id))
                            resolveError(`${id} is not a valid ID`)
                        else
                            resolveOk(UIAction.Delete(Number(id)))
                    })
                    break
                case 'q':
                    resolveOk(UIAction.Exit)
                    break
                default:
                    resolveError(`${input} is not a valid action`)
                    break
                }
            })
        })
    },

    DisplayAllTokens: () => {
        DataStore.tokens.forEach(t => console.log(t.toString()))
        return Future.of({})
    },

    ConfirmDeletion: (tokenID) => {
        return new Future((reject, resolve) => {
            const prompt = `Are you sure you want to delete token ${tokenID}? [Y/N] #> `
            ReadLine.question(prompt, sure => {
                resolve(sure.toLowerCase() === 'y')
            })
        })
    },

    PromptNewTokenName: () => {
        return new Future((reject, resolve) => {
            ReadLine.question('New token name? #> ', name => {
                resolve(name)
            })
        })
    },

    DisplayNewToken: (token) => {
        console.log('New token created:', token.toString())
        return Future.of({})
    }
}

program.interpretM(effectsInterpreter)
    .fold(Result.Error, Result.Ok)
    .value(value => {
        console.log('Program returned:', value.toString())
        ReadLine.close()
    })
