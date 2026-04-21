---
name: code-convention
description: 프로젝트 고유 코딩 컨벤션(필드 네이밍, Boolean 접두사 금지, ktlint 포맷팅 등). Kotlin 코드 작성/수정 시 참조한다.
---

# 코딩 컨벤션

## 필드 네이밍 — 자기 도메인 vs 외부 도메인

자기 자신의 도메인을 가리키는 식별자/속성은 도메인명 없이 그대로 쓰고, **다른 도메인**의 식별자/속성은 `도메인명 + 필드명` 형태로 쓴다. id 뿐 아니라 name, code 등 모든 참조 필드에 동일하게 적용한다.

목적: 프론트/백엔드 모두가 "이 id가 어느 테이블의 id인지" 같은 질문을 하지 않도록 필드 이름에 출처를 명시한다.

```kotlin
// WRONG — Employee 응답인데 id가 실제로는 user id라 혼동됨
data class EmployeeResponse(
    val id: Long,            // user id인가 employee id인가?
    val department: Long?,   // 무엇의 Long인가?
    val departmentName: String?,
)
```

```kotlin
// CORRECT — 외부 도메인 참조는 도메인명 명시
data class EmployeeResponse(
    val userId: Long,        // 원천이 User 도메인임이 드러남
    val departmentId: Long?,
    val departmentName: String?,
    val skillGradeId: Long?,
    val skillGradeName: String?,
)

// 자기 자신의 도메인 안에서는 그냥 id
data class User(
    val id: Long,
    val email: String,
)
```

**체크포인트**
- Response / Result / Query DTO에 `id` 가 있다면 그 객체 자신의 식별자인지 확인한다. 아니면 `{도메인}Id` 로 바꾼다.
- Request DTO의 `ids: List<Long>` 도 어느 도메인의 id인지 이름에 드러낸다 (`userIds`, `projectIds` 등).
- JPA Entity의 `id` 는 해당 엔티티 자기 자신의 PK이므로 그대로 `id` 로 유지한다. 단 FK 컬럼은 `departmentId`, `userId` 처럼 외부 도메인명을 붙인다.

## Boolean 네이밍

Boolean 프로퍼티에 `is` 접두사를 붙이지 않는다.

```kotlin
// WRONG
data class ProjectResponse(
    val isActive: Boolean,
    val isLocked: Boolean,
)

// CORRECT
data class ProjectResponse(
    val active: Boolean,
    val locked: Boolean,
)
```

## ktlint

`./gradlew ktlintFormat` 으로 자동 포맷팅. Git pre-commit hook이 자동 실행된다.
