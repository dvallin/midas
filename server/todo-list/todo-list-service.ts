import { ContextExtensionMiddleware } from '../../src/middleware'
import { applyFilter, TodosFilter } from '../model/todo-filter'
import { v4 as uuid } from 'uuid'
import { Todo, TodoSchema } from '../model/todo'
import { TodoListStorageContext } from './todo-list-context'
import { parseThrowing } from '../../src/ecs/component/dynamo-db/schema-parse'
import { ReadBeforeWriteUpdate } from '../../src/ecs/component'
import { mutate } from '../../src/middleware/mutable-context'

type TodoListServiceMethod<In, Out> = ContextExtensionMiddleware<
  In & TodoListStorageContext,
  Out,
  unknown
>

export type TodoIdRequest = { request: { id: string } }
export type ListIdRequest = { request: { listId: string } }
export type FilterRequest = { request: { filter: TodosFilter } }
export type CreateNewTodoRequest = { request: { todoName: string } }
export type UpdateTodoRequest = { request: { todo: Todo } }

export type TodosContext = { todos: Todo[] }

export const loadTodoList = <C>(): TodoListServiceMethod<
  C & ListIdRequest,
  TodosContext
> => {
  return async (_, ctx, next) => {
    const todos = (await ctx.storages.todoList.read(ctx.request.listId)) ?? []
    const nextContext = mutate(ctx, 'todos', todos)
    return next(nextContext)
  }
}

export const filterTodos = <C>(): TodoListServiceMethod<
  C & { todos: Todo[] } & FilterRequest,
  { todos: Todo[]; filter: TodosFilter }
> => {
  return (_, ctx, next) => {
    const todos = applyFilter(ctx.todos, ctx.request.filter)
    const withTodos = mutate(ctx, 'todos', todos)
    const nextContext = mutate(withTodos, 'filter', ctx.request.filter)
    return next(nextContext)
  }
}
export const itemsLeft = <C>(): TodoListServiceMethod<
  C & { todos: Todo[] },
  { itemsLeft: number }
> => {
  return (_, ctx, next) => {
    const itemsLeft = applyFilter(ctx.todos, 'active').length
    const nextContext = mutate(ctx, 'itemsLeft', itemsLeft)
    return next(nextContext)
  }
}

export const findTodoById = <C>(): TodoListServiceMethod<
  C & { todos: Todo[] } & TodoIdRequest,
  { todo: Todo }
> => {
  return (_, ctx, next) => {
    const { id } = ctx.request
    const todo = ctx.todos.find((t) => t.id === id)
    if (!todo) {
      throw new Error(`could not find todo ${id}`)
    }
    const nextContext = mutate(ctx, 'todo', todo)
    return next(nextContext)
  }
}

export const addTodo = <C>(): TodoListServiceMethod<
  C & CreateNewTodoRequest & ListIdRequest,
  { todo: Todo }
> => {
  return async (_, ctx, next) => {
    const newTodo = parseThrowing(TodoSchema, {
      id: uuid(),
      name: ctx.request.todoName,
      done: false,
    })
    await ctx.storages.todoList.arrayPush(ctx.request.listId, newTodo)
    const nextContext = mutate(ctx, 'todo', newTodo)
    return next(nextContext)
  }
}

const updateTodoList = <C extends ListIdRequest>(
  updater: (
    previous: Todo[] | null | undefined,
    request: C['request'],
  ) => Todo[],
): TodoListServiceMethod<C, { todos: Todo[] }> => {
  return async (_, ctx, next) => {
    const { component: todos } = await new ReadBeforeWriteUpdate(
      ctx.storages.todoList,
    ).update(ctx.request.listId, (todos) => updater(todos, ctx.request))
    const nextContext = mutate(ctx, 'todos', todos)
    return next(nextContext)
  }
}

export function toggleTodo<C extends ListIdRequest & TodoIdRequest>() {
  return updateTodoList<C>((todos, request) =>
    (todos ?? []).map((todo) =>
      todo.id === request.id ? { ...todo, done: !todo.done } : todo
    )
  )
}

export function updateTodo<
  C extends ListIdRequest & TodoIdRequest & UpdateTodoRequest,
>() {
  return updateTodoList<C>((todos, request) =>
    (todos ?? []).map((todo) =>
      todo.id === request.id ? { ...todo, ...request.todo } : todo
    )
  )
}

export function removeTodo<C extends ListIdRequest & TodoIdRequest>() {
  return updateTodoList<C>((todos, request) =>
    (todos ?? []).filter((todo) => todo.id !== request.id)
  )
}

export function clearCompleted<C extends ListIdRequest>() {
  return updateTodoList<C>((todos) =>
    (todos ?? []).filter((todo) => !todo.done)
  )
}
