import { InferType, boolean, literals, object, string } from '@spaceteams/zap'
import * as bodyParser from 'body-parser'
import * as express from 'express'
import * as pug from 'pug'
import { v4 as uuid } from 'uuid'
import { component } from './src/ecs'

class TodoListService {
  readonly readBeforeWriteUpdate: component.ReadBeforeWriteUpdate<Todo[]>
  constructor(readonly todoLists: component.ArrayStorage<Todo>) {
    this.readBeforeWriteUpdate = new component.ReadBeforeWriteUpdate(
      this.todoLists,
    )
  }

  async getAll(listId: string) {
    return (await this.todoLists.read(listId)) ?? []
  }

  add(listId: string, newTodo: Todo) {
    return this.todoLists.arrayPush(listId, newTodo)
  }

  clearCompleted(listId: string) {
    return this.readBeforeWriteUpdate.update(listId, (todos) =>
      (todos ?? []).filter((todo) => !todo.done),
    )
  }

  delete(listId: string, id: string) {
    return this.readBeforeWriteUpdate.update(listId, (todos) =>
      (todos ?? []).filter((todo) => todo.id !== id),
    )
  }

  toggle(listId: string, id: string) {
    return this.readBeforeWriteUpdate.update(listId, (todos) =>
      (todos ?? []).map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    )
  }

  update(listId: string, id: string, name: string) {
    return this.readBeforeWriteUpdate.update(listId, (todos) =>
      (todos ?? []).map((todo) => (todo.id === id ? { ...todo, name } : todo)),
    )
  }
}

const TodoSchema = object({ id: string(), name: string(), done: boolean() })
type Todo = InferType<typeof TodoSchema>
const todoListsStorage = new component.InMemoryArrayStorage<Todo>()
const todoListService = new TodoListService(todoListsStorage)

const getItemsLeft = (todos: Todo[]) => filterTodos(todos, 'active').length

const TodosFilterSchema = literals('all', 'active', 'completed')
type TodosFilter = InferType<typeof TodosFilterSchema>
function filterTodos(todos: Todo[], filter: TodosFilter) {
  switch (filter) {
    case 'all':
      return todos
    case 'active':
      return todos.filter((t) => !t.done)
    case 'completed':
      return todos.filter((t) => t.done)
  }
}

const app = express()
app.set('view engine', 'pug')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('assets'))

const listId = 'list-1'
app.get('/', async (req, res) => {
  const { filter } = req.query
  const todos = await todoListService.getAll(listId)
  const filteredTodos = filterTodos(
    todos,
    TodosFilterSchema.accepts(filter) ? filter : 'all',
  )

  res.render('index', {
    todos: filteredTodos,
    filter,
    itemsLeft: getItemsLeft(todos),
  })
})

const editItemTemplate = pug.compileFile('views/includes/edit-item.pug')
const itemCountTemplate = pug.compileFile('views/includes/item-count.pug')
const todoItemTemplate = pug.compileFile('views/includes/todo-item.pug')
const todoListTemplate = pug.compileFile('views/includes/todo-list.pug')
const renderEditTodoItem = (todo: Todo) => editItemTemplate({ todo })
const renderItemCount = (todos: Todo[]) =>
  itemCountTemplate({ itemsLeft: getItemsLeft(todos) })
const renderTodoItem = (todo: Todo) => todoItemTemplate({ todo })
const renderTodoList = (todos: Todo[]) => todoListTemplate({ todos })

app.post('/todos', async (req, res) => {
  const { todo } = req.body
  const newTodo = {
    id: uuid(),
    name: todo,
    done: false,
  }
  await todoListService.add(listId, newTodo)

  const todos = await todoListService.getAll(listId)
  res.send(renderTodoItem(newTodo) + renderItemCount(todos))
})

app.get('/todos/edit/:id', async (req, res) => {
  const { id } = req.params

  const todos = await todoListService.getAll(listId)
  const todo = todos.find((t) => t.id === id)
  if (todo) {
    res.send(renderEditTodoItem(todo))
  }
})

app.patch('/todos/:id', async (req, res) => {
  const { id } = req.params
  const { component: todos } = await todoListService.toggle(listId, id)

  const todo = todos.find((t) => t.id === id)
  if (todo) {
    res.send(renderTodoItem(todo) + renderItemCount(todos))
  }
})

app.post('/todos/update/:id', async (req, res) => {
  const { id } = req.params
  const { name } = req.body
  const { component: todos } = await todoListService.update(listId, id, name)

  const todo = todos.find((t) => t.id === id)
  if (todo) {
    res.send(renderTodoItem(todo) + renderItemCount(todos))
  }
})

app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params
  const { component: todos } = await todoListService.delete(listId, id)

  res.send(renderItemCount(todos))
})

app.post('/todos/clear-completed', async (_req, res) => {
  const { component: todos } = await todoListService.clearCompleted(listId)

  res.send(renderTodoList(todos) + renderItemCount(todos))
})

const PORT = process.env.PORT || 3000
app.listen(PORT)
console.log('Listening on port: ' + PORT)
