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

ReadLine.on('close', () => process.stdin.destroy())

// Our data store
const Store = {
    tokens: [],
}

const effectsInterpreter = {
    Return: (value) =>
        Future.of(value),

    NotifyError: (error) =>
        Future.reject(error),

    ListTokens: () => {
        Store.tokens = [
            Token(1, '****abcd'),
            Token(2, '****efgh'),
            Token(3, '****ijkl'),
            Token(4, '****mnop'),
        ]
        return Future.of(Result.Ok(Store.tokens))
    },

    DeleteToken: (tokenID) => {
        return new Future((reject, resolve) => {
            const i = Store.tokens.findIndex(t => t.id === tokenID)

            if (i < 0)
                reject(`Invalid token ID: ${tokenID}`)
            else {
                console.log(`Deleting token ${tokenID}...`)
                resolve({})
            }
        })
    },

    CreateToken: (tokenName) => {
        console.log('Creating token...')
        const tokenID = Store.tokens.map(t => t.id).reduce((i2, i) => i > i2 ? i : i2, 0) + 1
        const token = Token(tokenID, '****' + tokenName.substr(tokenName.length - 4, 4))
        Store.tokens.push(token)
        return Future.after(1000, token)
    },

    NotifyError: (error) =>
        Future.reject(error),

    AwaitUIAction: () => {
        return new Future((reject, resolve) => {
            const prompt = `
What would you like to do?
S: show all tokens
C: create a token
D: delete a token
Q: quit
action #> `
            ReadLine.question(prompt, input => {
                switch (input.toLowerCase()) {
                case 's':
                    resolve(UIAction.Show)
                    break
                case 'c':
                    resolve(UIAction.Create)
                    break
                case 'd':
                    ReadLine.question('Which token id? #> ', id => {
                        if (Number.isNaN(id))
                            reject(`${id} is not a valid ID`)
                        else
                            resolve(UIAction.Delete(Number(id)))
                    })
                    break
                case 'q':
                    resolve(UIAction.Exit)
                    break
                default:
                    reject(`${input} is not a valid action`)
                    break
                }
            })
        })
    },

    DisplayAllTokens: () => {
        console.log(Store.tokens)
        return Future.of({})
    },

    ConfirmDeletion: (tokenID) => {
        return new Future((reject, resolve) => {
            const prompt = `Are you sure you want to delete token ${tokenID}?\n[Y/N] #> `
            ReadLine.question(prompt, sure => {
                resolve(sure.toLowerCase() === 'y')
            })
        })
    },

    PromptNewTokenName: () => {
        return new Future((reject, resolve) => {
            ReadLine.question('New token name? #> ', name => {
                if (name.length < 8)
                    reject('Token name should be 8 or more characters')
                else
                    resolve(name)
            })
        })
    },

    DisplayNewToken: (token) => {
        console.log('New token created:', token)
        return Future.of({})
    }
}

program.interpretM(effectsInterpreter).fork(
    error => {
        console.error('Oops: ', error)
        ReadLine.close()
    },
    result => {
        console.log('Program returned:', result.toString())
        ReadLine.close()
    }
)
