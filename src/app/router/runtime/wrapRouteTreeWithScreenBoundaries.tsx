import React from "react";
import type { RouteObject } from "react-router-dom";
import { RouteScreenBoundary } from "./RouteScreenBoundary";

function routeIdentity(route: RouteObject, index: number, parentId: string): string {
  if (route.id) return String(route.id);
  if (route.index) return `${parentId}:index`;
  if (route.path) return `${parentId}:${route.path}`;
  return `${parentId}:route-${index}`;
}

function wrapRouteElement(route: RouteObject, routeId: string): React.ReactNode {
  if (!route.element) return route.element;
  return <RouteScreenBoundary routeId={routeId}>{route.element}</RouteScreenBoundary>;
}

export function wrapRouteTreeWithScreenBoundaries(
  routes: RouteObject[],
  parentId = "app",
): RouteObject[] {
  return routes.map((route, index) => {
    const routeId = routeIdentity(route, index, parentId);
    const element = wrapRouteElement(route, routeId);

    if (route.index) {
      return {
        ...route,
        element,
      } as RouteObject;
    }

    return {
      ...route,
      element,
      children: route.children
        ? wrapRouteTreeWithScreenBoundaries(route.children, routeId)
        : route.children,
    } as RouteObject;
  });
}
