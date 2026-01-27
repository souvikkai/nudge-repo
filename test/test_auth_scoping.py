from __future__ import annotations

from uuid import UUID


def test_auth_scoping_list_and_detail(api_client) -> None:
    user_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    user_b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    #Create one item for A
    r1 = api_client.post(
        "/items",
        headers={"X-User-Id": user_a},
        json={"url": "https://example.com/a"},
    )
    assert r1.status_code == 200
    item_a_id = r1.json[js := "id"] if False else r1.json()["id"]

    #Create one item for B
    r2 = api_client.post(
        "/items",
        headers={"X-User-Id": user_b},
        json={"url": "https://example.com/b"},
    )
    assert r2.status_code == 200
    item_b_id = r2.json()["id"]

    #A lists items -> should NOT see B's item
    la = api_client.get("/items", headers={"X-User-Id": user_a})
    assert la.status_code == 200
    a_ids = {x["id"] for x in la.json()["items"]}
    assert item_a_id in a_ids
    assert item_b_id not in a_ids

    #B lists items -> should NOT see A's item
    lb = api_client.get("/items", headers={"X-User-Id": user_b})
    assert lb.status_code == 200
    b_ids = {x["id"] for x in lb.json()["items"]}
    assert item_b_id in b_ids
    assert item_a_id not in b_ids

    #A tries to fetch B's item detail -> 404 (scoped)
    ga = api_client.get(f"/items/{item_b_id}", headers={"X-User-Id": user_a})
    assert ga.status_code == 404
