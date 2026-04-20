from bson import ObjectId


def doc_to_out(doc: dict) -> dict:
    """Convert a MongoDB document to a serializable dict with 'id' field."""
    result = {k: v for k, v in doc.items() if k != "_id"}
    result["id"] = str(doc["_id"])
    for k, v in result.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
    return result
