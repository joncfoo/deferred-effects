const test = require('tape')
const Future = require('fluture')
const {
    Program,
    ProgramView,
    makeInstructions,
} = require('../src/operational')

test('Program', T => {
    T.test('.of', t => {
        t.deepEqual(
            Program.of(42),
            Program.Lift(42),
            'of === Lift',
        )
        t.end()
    })

    T.test('.emit', t => {
        t.deepEqual(
            Program.emit('nyaa'),
            Program.Instr('nyaa'),
            'emit === Instr',
        )
        t.end()
    })

    T.test('.prototype.chain', t => {
        t.deepEqual(
            Program.of('hello').chain(Program.emit),
            Program.Bind(Program.Lift('hello'), Program.emit),
            'chain correctly builds up a thunk',
        )
        t.end()
    })

    T.test('.prototype.andThen', t => {
        const next = Program.Instr(99)
        const actual = Program.of('hello').andThen(next)

        actual.cata({
            Lift: () => t.fail('unexpected'),
            Instr: () => t.fail('unexpected'),
            Bind: (action, continuation) => {
                t.deepEqual(action, Program.Lift('hello'))
                t.deepEqual(continuation(), next)
            }
        })

        t.end()
    })

    T.test('.prototype.map', t => {
        const f = x => x + 10
        // this is a dirty, dirty test
        t.equal(
            Program.Bind(Program.Lift(42), a => Program.of(f(a))).toString(),
            Program.of(42).map(f).toString(),
            'map correctly builds up a thunk',
        )
        t.end()
    })

    T.test('.prototype.toProgramView', t => {
        t.deepEqual(
            Program.of(42).toProgramView(),
            ProgramView.Return(42),
            'Lift === Return'
        )

        t.deepEqual(
            Program.emit('doit').toProgramView(),
            ProgramView.Continue('doit', Program.of),
            'Instr === Continue',
        )

        const plus10M = x => Program.of(x + 10)
        t.deepEqual(
            Program.of(42).chain(plus10M).toProgramView(),
            ProgramView.Return(52),
            'Lift(x) >>= f(x) === Return(y)',
        )

        t.deepEqual(
            Program.emit('doit').chain(plus10M).toProgramView(),
            ProgramView.Continue('doit', plus10M),
            'Instr(x) >>= f(x) === Continue(x)',
        )

        const div5M = y => Program.of(y / 5)
        t.deepEqual(
            Program.of(40).chain(plus10M).chain(div5M).toProgramView(),
            ProgramView.Return(10),
            'Lift(x) >>= f >>= g === ???',
        )

        t.end()
    })

    T.test('.do', t => {
        const {Get, Put} = makeInstructions('Store', {
            Get: ['name'],
            Put: ['name', 'value'],
        })

        const programNoReturn = Program.do(function*() {
            const k = yield Get('k')
            yield Put('l', k + '!!')
            yield Get('l')
        })

        const programWithReturn = Program.do(function*() {
            const k = yield Get('k')
            yield Put('l', k + '!!')
            const l = yield Get('l')
            return l
        })

        const store = { k: 'hello' }
        const programAsFuture = {
            Return: (value) =>
                Future.of(value),
            Get: (value) =>
                new Future((reject, resolve) => {
                    if (value in store)
                        resolve(store[value])
                    else
                        reject(`store does not contain key: ${value}`)
                }),
            Put: (name, value) =>
                new Future((reject, resolve) => {
                    store[name] = value
                    resolve({})
                }),
        }

        const run = program => program.interpretM(programAsFuture).fork(
            error => {
                t.fail('Unexpected: ' + error)
            },
            result => {
                t.equals(result, 'hello!!')
            }
        )

        run(programNoReturn)
        run(programWithReturn)

        t.end()
    })

    T.test('.prototype.interpretM', t => {
        const {Get, Put} = makeInstructions('Store', {
            Get: ['name'],
            Put: ['name', 'value'],
        })

        const program =
              Get('k').chain(
                  k => Put('l', k + '!!').chain(
                      () => Get('l')
                  )
              )

        const store = { k: 'hello' }
        const programAsFuture = {
            Return: (value) =>
                Future.of(value),
            Get: (value) =>
                new Future((reject, resolve) => {
                    if (value in store)
                        resolve(store[value])
                    else
                        reject(`store does not contain key: ${value}`)
                }),
            Put: (name, value) =>
                new Future((reject, resolve) => {
                    store[name] = value
                    resolve({})
                }),
        }

        program.interpretM(programAsFuture).fork(
            error => {
                t.fail('Unexpected: ' + error)
            },
            result => {
                t.equals(result, 'hello!!')
            }
        )

        t.end()
    })

    T.end()
})

test('makeInstructions', T => {
    T.test('creates callable instructions that throw an error', t => {
        const IO = makeInstructions('IO', {
            IO: ['value'],
        })

        t.throws(() => IO(42), "Instruction was called instead of.*")
        t.end()
    })

    T.test('wraps constructors with Instr', t => {
        const {Nothing, Just} = makeInstructions('Maybe', {
            Nothing: [],
            Just: ['value'],
        })
        t.ok(Program.Instr.is(Nothing), 'Nothing is wrapped in Instr')
        t.ok(Program.Instr.is(Just(42)), 'Just is wrapped in Instr')
        t.end()
    })

    T.end()
})
