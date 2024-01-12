import { Express } from 'express'
import {
  addTodo,
  clearCompleted,
  CreateNewTodoRequest,
  FilterRequest,
  filterTodos,
  findTodoById,
  itemsLeft,
  ListIdRequest,
  loadTodoList,
  removeTodo,
  TodoIdRequest,
  toggleTodo,
  updateTodo,
  UpdateTodoRequest,
} from './todo-list-service'
import {
  renderTodoItemEditMode,
  renderTodoListIndex,
  renderUpdatedTodoItem,
  renderUpdatedTodoList,
} from './todo-list-views'
import { pipeline } from '../../src/pipeline'
import {
  ContextExtensionMiddleware,
  ExpressEvent,
  toExpressHandler,
} from '../../src/middleware'
import { TodoListContext } from './todo-list-context'
import { TodosFilterSchema } from '../model/todo-filter'
import { TodoSchema } from '../model/todo'
import { parseThrowing } from '../../src/ecs/component/dynamo-db/schema-parse'
import { defaultValue, object, optional, string } from '@spaceteams/zap'
import { lens, mutate } from '../../src/middleware/mutable-context'

const defaultPipeline = pipeline<ExpressEvent, TodoListContext>()

type RequestParser<C, Params> = ContextExtensionMiddleware<
  C,
  Params,
  ExpressEvent
>

const parseFilter = <C>(): RequestParser<C, FilterRequest> => {
  return ({ req }, ctx, next) => {
    const { filter } = req.query
    const parsedFilter = parseThrowing(
      defaultValue(optional(TodosFilterSchema), 'all'),
      filter,
    )
    const nextContext = lens(
      ctx,
      'request',
      (v) => mutate(v, 'filter', parsedFilter),
    )
    return next(nextContext)
  }
}

const parseListId = <C>(): RequestParser<C, ListIdRequest> => {
  return ({ req }, ctx, next) => {
    const { listId } = req.query
    const parsedListId = parseThrowing(
      defaultValue(optional(string()), 'list-1'),
      listId,
    )
    return next({
      ...ctx,
      request: { listId: parsedListId },
    })
  }
}

const parseTodoId = <C>(): RequestParser<C, TodoIdRequest> => {
  return ({ req }, ctx, next) => {
    const { id } = req.params
    return next({
      ...ctx,
      request: { id },
    })
  }
}

const parseCreateNewTodoRequest = <C>(): RequestParser<
  C,
  CreateNewTodoRequest
> => {
  return ({ req }, ctx, next) => {
    const request = parseThrowing(object({ todo: string() }), req.body)
    return next({
      ...ctx,
      request: { todoName: request.todo },
    })
  }
}

const parseUpdateTodoRequest = <C>(): RequestParser<C, UpdateTodoRequest> => {
  return ({ req }, ctx, next) => {
    const todo = parseThrowing(TodoSchema, req.body)
    return next({
      ...ctx,
      request: { todo },
    })
  }
}

export function register(app: Express, context: TodoListContext) {
  app.get(
    '/',
    toExpressHandler(
      defaultPipeline
        .use(parseListId())
        .use(parseFilter())
        .use(loadTodoList())
        .use(itemsLeft())
        .use(filterTodos())
        .use(renderTodoListIndex()),
      context,
    ),
  )
  app.post(
    '/todos',
    toExpressHandler(
      defaultPipeline
        .use(parseListId())
        .use(parseCreateNewTodoRequest())
        .use(loadTodoList())
        .use(addTodo())
        .use(itemsLeft())
        .use(renderUpdatedTodoItem()),
      context,
    ),
  )
  app.get(
    '/todos/edit/:id',
    toExpressHandler(
      defaultPipeline
        .use(parseListId())
        .use(parseTodoId())
        .use(loadTodoList())
        .use(findTodoById())
        .use(renderTodoItemEditMode()),
      context,
    ),
  )
  app.get(
    '/todos/:id',
    toExpressHandler(
      defaultPipeline
        .use(parseTodoId())
        .use(parseListId())
        .use(toggleTodo())
        .use(findTodoById())
        .use(itemsLeft())
        .use(renderUpdatedTodoItem()),
      context,
    ),
  )
  app.post(
    '/todos/update/:id',
    toExpressHandler(
      defaultPipeline
        .use(parseTodoId())
        .use(parseListId())
        .use(parseUpdateTodoRequest())
        .use(updateTodo())
        .use(findTodoById())
        .use(itemsLeft())
        .use(renderUpdatedTodoItem()),
      context,
    ),
  )
  app.post(
    '/todos/:id',
    toExpressHandler(
      defaultPipeline
        .use(parseTodoId())
        .use(parseListId())
        .use(removeTodo())
        .use(findTodoById())
        .use(itemsLeft())
        .use(renderUpdatedTodoItem()),
      context,
    ),
  )
  app.post(
    '/todos/clear-completed',
    toExpressHandler(
      defaultPipeline
        .use(parseListId())
        .use(clearCompleted())
        .use(itemsLeft())
        .use(renderUpdatedTodoList()),
      context,
    ),
  )
}
