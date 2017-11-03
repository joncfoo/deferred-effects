const daggy = require('daggy')
const {Program, makeInstructions} = require('../src/index')

// Result error success
const Result = daggy.taggedSum('Result', {
    Error: ['error'],
    Ok: ['value'],
})

const UIAction = daggy.taggedSum('UIAction', {
    Show: [],
    Delete: ['tokenID'],
    Create: [],
    Exit: [],
    Unknown: ['helpMessage'],
})

const Token = daggy.tagged('Token', ['id', 'token'])

const Instruction = makeInstructions('Instruction', {
    // ======================
    // ==== external API ====
    // ======================

    // ListTokens :: Program (Result String [Token])
    ListTokens: [],

    // DeleteToken :: Int -> Program (Result String {})
    DeleteToken: ['tokenID'],

    // CreateToken :: String -> Program (Result String Token)
    CreateToken: ['tokenName'],

    // ====================
    // ==== UI-related ====
    // ====================

    // NotifyError :: String -> Program ()
    NotifyError: ['error'],

    // AwaitUIAction :: Program (Result UIAction)
    AwaitUIAction: [],

    // ConfirmDeletion :: Int -> Program ()
    ConfirmDeletion: ['tokenID'],

    // PromptNewTokenName :: Program String
    PromptNewTokenName: [],

    // DisplayNewToken :: Token -> Program ()
    DisplayNewToken: ['token'],

    // DisplayAllTokens :: Program ()
    DisplayAllTokens: [],
})

const program = Program.do(function *() {
    // tokensResult :: Result String [Token]
    const tokensResult = yield Instruction.ListTokens

    // upon failure notify of error
    if (Result.Error.is(tokensResult)) {
        yield Instruction.NotifyError(tokensResult.error)
        return
    }

    // loop forever, waiting for UIActions
    while (1) {

        // actionResult :: Result String UIAction
        const actionResult = yield Instruction.AwaitUIAction

        // if there was an error, simply display and wait for input again
        if (Result.Error.is(actionResult)) {
            yield Instruction.NotifyError(actionResult.error)
            continue
        }

        // extract UIAction
        const action = actionResult.value

        // asked to quit
        if (UIAction.Exit.is(action)) {
            break
        }

        // unsure what user wanted so try again
        if (UIAction.Unknown.is(action)) {
            yield Instruction.NotifyError(action.helpMessage)
            continue
        }

        // delete a token
        if (UIAction.Delete.is(action)) {
            const tokenID = action.tokenID

            // ask for confirmation
            const confirmed = yield Instruction.ConfirmDeletion(tokenID)

            if (confirmed) {
                const deleteResult = yield Instruction.DeleteToken(tokenID)

                // if there was an error simply notify the user
                if (Result.Error.is(deleteResult)) {
                    yield Instruction.NotifyError(deleteResult.error)
                }
            }
        }

        // create token
        if (UIAction.Create.is(action)) {
            // ask for token name
            const tokenName = yield Instruction.PromptNewTokenName

            const tokenResult = yield Instruction.CreateToken(tokenName)

            // notify token creation result
            if (Result.Error.is(tokenResult)) {
                yield Instruction.NotifyError(tokenResult.error)
            } else {
                yield Instruction.DisplayNewToken(tokenResult.value)
            }
        }

        // display all tokens
        if (UIAction.Show.is(action)) {
            yield Instruction.DisplayAllTokens
        }
    }
})

module.exports = {
    program,
    Instruction,
    UIAction,
    Result,
    Token,
}
