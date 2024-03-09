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
import { mutableContext, pipeline } from '../../../middleware/middleware-core'
import {
  ExpressEvent,
  ExpressRequestParser,
  toExpressHandler,
} from '../../../middleware/middleware-express'
import { TodoListContext } from './todo-list-context'
import { TodosFilterSchema } from '../model/todo-filter'
import { TodoSchema } from '../model/todo'
import { defaultValue, object, optional, string } from '@spaceteams/zap'
import { parseThrowing } from '../../../schema-parse'

const defaultPipeline = pipeline<ExpressEvent, TodoListContext>()

const parseFilter = <C>(): ExpressRequestParser<C, FilterRequest> => {
  return ({ req }, ctx, next) => {
    const { filter } = req.query
    const parsedFilter = parseThrowing(
      defaultValue(optional(TodosFilterSchema), 'all'),
      filter,
    )
    const nextContext = mutableContext.lens(
      ctx,
      'request',
      (v) => mutableContext.mutate(v, 'filter', parsedFilter),
    )
    return next(nextContext)
  }
}

const parseListId = <C>(): ExpressRequestParser<C, ListIdRequest> => {
  return ({ req }, ctx, next) => {
    const { listId } = req.query
    const parsedListId = parseThrowing(
      defaultValue(optional(string()), 'list-1'),
      listId,
    )
    const nextContext = mutableContext.lens(
      ctx,
      'request',
      (v) => mutableContext.mutate(v, 'listId', parsedListId),
    )
    return next(nextContext)
  }
}

const parseTodoId = <C>(): ExpressRequestParser<C, TodoIdRequest> => {
  return ({ req }, ctx, next) => {
    const { id } = req.params
    const nextContext = mutableContext.lens(
      ctx,
      'request',
      (v) => mutableContext.mutate(v, 'id', id),
    )
    return next(nextContext)
  }
}

const parseCreateNewTodoRequest = <C>(): ExpressRequestParser<
  C,
  CreateNewTodoRequest
> => {
  return ({ req }, ctx, next) => {
    const request = parseThrowing(object({ todo: string() }), req.body)
    const nextContext = mutableContext.lens(
      ctx,
      'request',
      (v) => mutableContext.mutate(v, 'todoName', request.todo),
    )
    return next(nextContext)
  }
}

const parseUpdateTodoRequest = <C>(): ExpressRequestParser<
  C,
  UpdateTodoRequest
> => {
  return ({ req }, ctx, next) => {
    const todo = parseThrowing(TodoSchema, req.body)
    const nextContext = mutableContext.lens(
      ctx,
      'request',
      (v) => mutableContext.mutate(v, 'todo', todo),
    )
    return next(nextContext)
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
